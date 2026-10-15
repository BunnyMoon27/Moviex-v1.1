import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
await mongoose.connect(process.env.MONGODB_URI);
const users=mongoose.connection.collection('users');
const passwordHash=await bcrypt.hash('MovieXDemo2026!Pass',12);
for(const [role,email,name] of [['admin','demo-admin@moviex.test','Demo Administrator'],['customer','demo-customer@moviex.test','Demo Customer']]){
 await users.updateOne({email},{$set:{name,email,role,passwordHash,updatedAt:new Date()},$setOnInsert:{createdAt:new Date()}},{upsert:true});
 console.log(role+' ready');
}
await mongoose.disconnect();
