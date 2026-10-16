import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
const api='http://127.0.0.1:4000/api';
const id=randomUUID().slice(0,8), email=`test-admin-${id}@example.test`, pass='Test1234';
const checks=[];const assert=(label,ok,detail='')=>{checks.push({label,pass:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+label+(detail?' '+detail:''));};
const call=async(path,method='GET',body,token)=>{const r=await fetch(api+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});let data;try{data=await r.json()}catch{}return {status:r.status,data};};
let admin,staff,customer,booking,cancelBooking,showtime;
await mongoose.connect(process.env.MONGODB_URI);
const users=mongoose.connection.collection('users');
try{
 const hash=await bcrypt.hash(pass,12);admin=await users.insertOne({name:'Integration Admin',email,passwordHash:hash,role:'admin',createdAt:new Date(),updatedAt:new Date()});
 const al=await call('/auth/login','POST',{email,password:pass});assert('Admin login',al.status===200&&al.data?.user?.role==='admin');const at=al.data?.token;
 const customerMail=`test-customer-${id}@example.test`;const cr=await call('/auth/register','POST',{name:'Integration Customer',email:customerMail,password:pass});assert('Customer registration',cr.status===201);customer=cr.data?.user?.id;const ct=cr.data?.token;
 const tooShort=await call('/admin/accounts','POST',{name:'Short Password',email:`short-${id}@example.test`,password:'Test123',role:'employee'},at);assert('Admin password minimum is 8 characters',tooShort.status===400);
 const pastDate=new Date(Date.now()-86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'});const pastShow=await call('/showtimes','POST',{movieId:1,cinema:'QA Cinema '+id,hall:'QA',date:pastDate,time:'10:30 AM',price:180},at);assert('Admin cannot create a past screening',pastShow.status===400);
 const denied=await call('/admin/accounts','GET',undefined,ct);assert('Customer blocked from admin accounts',denied.status===403);
 const sr=await call('/admin/accounts','POST',{name:'Integration Staff',email:`test-staff-${id}@example.test`,password:pass,role:'employee'},at);assert('Admin creates staff',sr.status===201,sr.data?.error||'');staff=sr.data?.id;
 const sl=await call('/auth/login','POST',{email:`test-staff-${id}@example.test`,password:pass});assert('Staff login',sl.status===200&&sl.data?.user?.role==='employee');const st=sl.data?.token;
 const accounts=await call('/admin/accounts','GET',undefined,at);assert('Admin lists accounts',accounts.status===200&&accounts.data.some(x=>x.id===staff));
 const edit=await call('/admin/accounts/'+staff,'PATCH',{name:'Updated Integration Staff'},at);assert('Admin updates staff',edit.status===200&&edit.data?.name==='Updated Integration Staff');
 const movies=await call('/movies');const movie=movies.data?.[0];assert('Movie catalogue',movies.status===200&&!!movie);
 const movieDenied=await call('/movies','POST',{title:'Not allowed'},ct);assert('Customer cannot create movie',movieDenied.status===403);
 const shows=await call('/showtimes');const future=new Date(Date.now()+7*86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'});const made=await call('/showtimes','POST',{movieId:movie.id,cinema:'Integration Test Cinema '+id,hall:'QA',date:future,time:'11:00 PM',price:250},at);const upcoming=made.data;showtime=upcoming?.id;assert('Showtime CRUD create',made.status===201,made.data?.error||'');assert('Showtime catalogue',shows.status===200&&shows.data?.length>0);
 if(upcoming){const br=await call('/bookings','POST',{showtimeId:upcoming.id,seats:['A10'],method:'GCash',paymentPlan:'Full'},ct);assert('Customer creates booking',br.status===201,br.data?.error||'');booking=br.data?.id;
 if(booking){const dup=await call('/bookings','POST',{showtimeId:upcoming.id,seats:['A10'],method:'GCash',paymentPlan:'Full'},ct);assert('Double booking blocked',dup.status===409,String(dup.status));const own=await call('/bookings','GET',undefined,ct);assert('Customer sees booking',own.status===200&&own.data.some(b=>b.id===booking)); const occupied=await call('/showtimes/'+upcoming.id+'/seats');assert('Public seat endpoint shows reservation',occupied.status===200&&occupied.data?.reserved?.includes('A10'));
 const invalid=await call('/bookings','POST',{showtimeId:upcoming.id,seats:['H12'],method:'GCash',paymentPlan:'Full'},ct);assert('Invalid seat rejected',invalid.status===400);
 const editLocked=await call('/showtimes/'+upcoming.id,'PUT',{id:upcoming.id,movieId:movie.id,cinema:upcoming.cinema,hall:upcoming.hall,date:upcoming.date,time:upcoming.time,price:260},at);assert('Active booking locks screening edit',editLocked.status===409);
 const other=await call('/auth/register','POST',{name:'Other Integration Customer',email:'test-other-'+id+'@example.test',password:pass});assert('Second customer registered',other.status===201);
 if(other.data?.token){
 const theirs=await call('/bookings','GET',undefined,other.data.token);assert('Other customer cannot see booking',theirs.status===200&&!theirs.data.some(b=>b.id===booking));
 const competing=await call('/bookings','POST',{showtimeId:upcoming.id,seats:['A10'],method:'GCash',paymentPlan:'Full'},other.data.token);assert('Cross-account seat conflict',competing.status===409);
 }
 const toCancel=await call('/bookings','POST',{showtimeId:upcoming.id,seats:['B2'],method:'Maya',paymentPlan:'30% deposit'},ct);
 cancelBooking=toCancel.data?.id;assert('Secondary reservation for cancellation',toCancel.status===201);
 if(cancelBooking){
 const occupiedBoth=await call('/showtimes/'+upcoming.id+'/seats');assert('Multiple seats reserved',occupiedBoth.data?.reserved?.includes('A10')&&occupiedBoth.data?.reserved?.includes('B2'));
 const cancelled=await call('/bookings/'+cancelBooking+'/status','PATCH',{status:'Cancelled'},ct);assert('Customer cancels future booking',cancelled.status===200);
 const freed=await call('/showtimes/'+upcoming.id+'/seats');assert('Cancelled seat is freed',freed.status===200&&!freed.data?.reserved?.includes('B2')&&freed.data?.reserved?.includes('A10'));
 const history=await call('/bookings','GET',undefined,ct);assert('Cancelled order retained in history',history.data?.some(b=>b.id===cancelBooking&&b.status==='Cancelled'));
 }
 const no=await call('/bookings/'+booking+'/status','PATCH',{status:'Confirmed'},st);assert('Staff cannot confirm',no.status===403);const confirmed=await call('/bookings/'+booking+'/status','PATCH',{status:'Confirmed'},at);assert('Admin confirms booking',confirmed.status===200,confirmed.data?.error||'');const checkin=await call('/bookings/'+booking+'/status','PATCH',{status:'Checked in'},st);assert('Staff checks in',checkin.status===200,checkin.data?.error||'');}
 }
 const del=await call('/admin/accounts/'+staff,'DELETE',undefined,at);assert('Admin revokes staff',del.status===204);
}finally{
 if(showtime){await mongoose.connection.collection('showtimes').deleteMany({id:showtime});}if(booking){await mongoose.connection.collection('reservedseats').deleteMany({bookingId:booking});await mongoose.connection.collection('bookings').deleteMany({id:booking});}if(cancelBooking){await mongoose.connection.collection('reservedseats').deleteMany({bookingId:cancelBooking});await mongoose.connection.collection('bookings').deleteMany({id:cancelBooking});}
 await users.deleteMany({email:{$in:[email,`test-staff-${id}@example.test`,`test-customer-${id}@example.test`]}});
 await users.deleteOne({email:'test-other-'+id+'@example.test'});
 await mongoose.disconnect();
 console.log('RESULT',checks.filter(x=>x.pass).length+'/'+checks.length,'passed; test records cleaned');
 if(checks.some(x=>!x.pass))process.exitCode=1;
}
