const bcrypt = require("bcryptjs");

exports.seed = async function (knex) {
  const hashedPassword = await bcrypt.hash("admin123", 10);
  await knex("users").insert([
    {
      name: "Admin User",
      username: "admin",
      email: "admin@example.com",
      mobile: "0000000000",
      password: hashedPassword,
      designation: "Administrator",
      location: "Head Office",
      role: "admin",
    },
  ]);
};
