import { z } from "zod";
import bcrypt from "bcryptjs";
export function registerAccountRoutes(app, { User, authenticate, allow, safe, fail, identity }) {
  const email = z.email().max(254).transform(value => value.toLowerCase());
  const createInput = z.object({
    name: z.string().trim().min(2).max(100),
    email,
    password: z.string().min(12).max(128),
    role: z.enum(["employee", "admin"]),
  }).strict();
  const updateInput = z.object({
    name: z.string().trim().min(2).max(100).optional(),
    email: email.optional(),
    password: z.string().min(12).max(128).optional(),
    role: z.enum(["employee", "admin"]).optional(),
  }).strict().refine(data => Object.keys(data).length > 0, "No changes supplied");
  app.get("/api/admin/accounts", authenticate, allow("admin"), safe(async (_req, res) => {
    const users = await User.find({ role: { $in: ["admin", "employee"] } }).sort({ role: 1, email: 1 });
    res.json(users.map(identity));
  }));
  app.post("/api/admin/accounts", authenticate, allow("admin"), safe(async (req, res) => {
    const parsed = createInput.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0].message);
    const { name, email: mail, password, role } = parsed.data;
    if (await User.exists({ email: mail })) return fail(res, 409, "Email already registered");
    const user = await User.create({ name, email: mail, role, passwordHash: await bcrypt.hash(password, 12) });
    res.status(201).json(identity(user));
  }));
  app.patch("/api/admin/accounts/:id", authenticate, allow("admin"), safe(async (req, res) => {
    const parsed = updateInput.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, parsed.error.issues[0].message);
    const target = await User.findById(req.params.id);
    if (!target || !["admin", "employee"].includes(target.role)) return fail(res, 404, "Account not found");
    if (String(target._id) === String(req.user._id) && parsed.data.role && parsed.data.role !== "admin")
      return fail(res, 409, "You cannot remove your own administrator role");
    const { password, ...changes } = parsed.data;
    if (changes.email && changes.email !== target.email && await User.exists({ email: changes.email })) return fail(res, 409, "Email already registered");
    Object.assign(target, changes);
    if (password) target.passwordHash = await bcrypt.hash(password, 12);
    await target.save();
    res.json(identity(target));
  }));
  app.delete("/api/admin/accounts/:id", authenticate, allow("admin"), safe(async (req, res) => {
    if (req.params.id === String(req.user._id)) return fail(res, 409, "You cannot delete your own account");
    const target = await User.findById(req.params.id);
    if (!target || !["admin", "employee"].includes(target.role)) return fail(res, 404, "Account not found");
    await target.deleteOne();
    res.status(204).end();
  }));
}
