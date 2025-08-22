exports.up = function (knex) {
  return knex.schema.createTable("users", (table) => {
    table.increments("id").primary();
    table.string("name").nullable();
    table.string("username", 50).unique().notNullable();
    table.string("email", 100).nullable();
    table.string("mobile", 20).nullable();
    table.string("password").notNullable();
    table.string("designation", 50).nullable();
    table.string("location", 100).nullable();
    table.enu("role", ["admin", "user"]).defaultTo("user");
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable("users");
};
