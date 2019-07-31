const { forwardTo } = require("prisma-binding");
const { hasPermission } = require("../utils");

const Query = {
  trainers: forwardTo("db"),
  trainer: forwardTo("db"),
  trainersConnection: forwardTo("db"),
  sports: forwardTo("db"),
  sport: forwardTo("db"),
  sportsConnection: forwardTo("db"),
  me: async (parent, args, ctx, info) => {
    if (!ctx.request.userId) {
      return null;
    }

    return ctx.db.query.user(
      {
        where: { id: ctx.request.userId }
      },
      info
    );
  },

  users: async (parent, args, ctx, info) => {
    if (!ctx.request.userId) {
      throw new Error("Debes estar loggeado!");
    }

    hasPermission(ctx.request.user, ["ADMIN", "PERMISSIONUPDATE"]);

    return ctx.db.query.users({}, info);
  }
};

module.exports = Query;
