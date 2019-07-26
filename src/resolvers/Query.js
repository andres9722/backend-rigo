const { forwardTo } = require("prisma-binding");

const Query = {
  users: forwardTo("db"),
  trainers: forwardTo("db"),
  trainer: forwardTo("db"),
  trainersConnection: forwardTo("db"),
  sports: forwardTo("db"),
  sport: forwardTo("db"),
  sportsConnection: forwardTo("db"),
  me(parent, args, ctx, info) {
    // check if there is a current user ID
    if (!ctx.request.userId) {
      return null;
    }
    return ctx.db.query.user(
      {
        where: { id: ctx.request.userId }
      },
      info
    );
  }
};

module.exports = Query;
