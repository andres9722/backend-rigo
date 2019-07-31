const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomBytes } = require("crypto");
const { promisify } = require("util");
const { transport, makeANiceEmail } = require("../mail");
const { hasPermission } = require("../utils");
const { pick } = require("lodash");

const Mutations = {
  createTrainer: async (parent, args, ctx, info) => {
    const trainer = await ctx.db.mutation.createTrainer(
      { data: { ...args, user: { connect: { id: ctx.request.userId } } } },
      info
    );

    return trainer;
  },
  updateTrainer: async (parent, args, ctx, info) => {
    const trainer = await ctx.db.mutation.updateTrainer({ ...args }, info);

    return trainer;
  },
  deleteTrainer: async (parent, { where }, ctx, info) => {
    const trainer = await ctx.db.query.trainer(
      { where },
      `{ id name email user { id }}`
    );

    const ownsTrainer = trainer.user.id === ctx.request.userId;

    const hasPermissions = ctx.request.user.permissions.some(permission =>
      ["ADMIN", "TRAINERDELETE"].includes(permission)
    );

    if (!ownsTrainer && !hasPermissions) {
      throw new Error("No tienes permisos para hacer esto!");
    }

    return ctx.db.mutation.deleteTrainer({ ...where }, info);
  },

  createSport: async (parent, args, ctx, info) => {
    const argumentss = pick(args, "name", "capacity", "type");

    const Sport = await ctx.db.mutation.createSport(
      {
        data: {
          ...argumentss,
          user: { connect: { id: ctx.request.userId } },
          trainer: { connect: { id: args.trainerId } },
          students: { create: args.students }
        }
      },
      info
    );

    return Sport;
  },
  updateSport: async (parent, args, ctx, info) => {
    const argumentss = pick(args, "name", "capacity", "type");
    console.log("TCL: argumentss", argumentss);

    const Sport = await ctx.db.mutation.updateSport(
      {
        data: {
          ...argumentss,
          trainer: { connect: { id: args.trainerId } }
        },
        where: { ...args.where }
      },
      info
    );
    console.log("TCL: Sport", Sport);

    return Sport;
  },
  deleteSport: async (parent, { where }, ctx, info) => {
    const sport = await ctx.db.query.sport(
      { where },
      `{ id name capacity type user { id }}`
    );

    const ownsSport = sport.user.id === ctx.request.userId;

    const hasPermissions = ctx.request.user.permissions.some(permission =>
      ["ADMIN", "SPORTDELETE"].includes(permission)
    );

    if (!ownsSport && !hasPermissions) {
      throw new Error("No tienes permisos para hacer esto!");
    }

    return ctx.db.mutation.deleteSport({ ...where }, info);
  },

  async signup(parent, args, ctx, info) {
    args.email = args.email.toLowerCase();

    const password = await bcrypt.hash(args.password, 10);

    const user = await ctx.db.mutation.createUser(
      {
        data: {
          ...args,
          password,
          permissions: { set: ["USER"] }
        }
      },
      info
    );

    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);

    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365
    });

    return user;
  },

  async signin(parent, { email, password }, ctx, info) {
    const user = await ctx.db.query.user({ where: { email } });

    if (!user) {
      throw new Error(`No existe usurio registrado con el correo: ${email}`);
    }

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      throw new Error("Invalid Password!");
    }

    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);

    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365
    });

    return user;
  },

  signout(parent, args, ctx, info) {
    ctx.response.clearCookie("token");
    return { message: "Goodbye!" };
  },

  async requestReset(parent, args, ctx, info) {
    const user = await ctx.db.query.user({ where: { email: args.email } });

    if (!user) {
      throw new Error(
        `No existe usurio registrado con el correo: ${args.email}`
      );
    }
    const randomBytesPromiseified = promisify(randomBytes);

    const resetToken = (await randomBytesPromiseified(20)).toString("hex");

    const resetTokenExpiry = Date.now() + 3600000;

    const res = await ctx.db.mutation.updateUser({
      where: { email: args.email },
      data: { resetToken, resetTokenExpiry }
    });

    const mailRes = await transport.sendMail({
      from: "wes@wesbos.com",
      to: user.email,
      subject: "Your Password Reset Token",
      html: makeANiceEmail(`Your Password Reset Token is here!
      \n\n
      <a href="${
        process.env.FRONTEND_URL
      }/reset?resetToken=${resetToken}">Click Here to Reset</a>`)
    });

    return { message: "Thanks!" };
  },
  async resetPassword(parent, args, ctx, info) {
    if (args.password !== args.confirmPassword) {
      throw new Error("Yo Passwords don't match!");
    }

    const [user] = await ctx.db.query.users({
      where: {
        resetToken: args.resetToken,
        resetTokenExpiry_gte: Date.now() - 3600000
      }
    });

    if (!user) {
      throw new Error("Token invalido!");
    }

    const password = await bcrypt.hash(args.password, 10);
    const updatedUser = await ctx.db.mutation.updateUser({
      where: { email: user.email },
      data: {
        password,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    const token = jwt.sign({ userId: updatedUser.id }, process.env.APP_SECRET);

    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365
    });

    return updatedUser;
  },

  updatePermissions: async (parent, args, ctx, info) => {
    if (!ctx.request.userId) {
      throw new Error("Debes estar loggeado!");
    }

    const currentUser = await ctx.db.query.user(
      {
        where: {
          id: ctx.request.userId
        }
      },
      info
    );

    hasPermission(currentUser, ["ADMIN", "PERMISSIONUPDATE"]);

    return ctx.db.mutation.updateUser(
      {
        data: {
          permissions: {
            set: args.permissions
          }
        },
        where: {
          id: args.userId
        }
      },
      info
    );
  }
};

module.exports = Mutations;
