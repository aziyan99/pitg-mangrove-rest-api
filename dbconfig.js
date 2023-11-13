import { Sequelize } from "sequelize";
import "dotenv/config";

const sequelize = new Sequelize("local-db", "user", "pass", {
    dialect: "sqlite",
    host: process.env.DATABASE_URL || "./db/db.sqlite"
});

export default sequelize;