import { Model, DataTypes } from "sequelize";
import sequelize from "../dbconfig.js";


export class User extends Model {}

User.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true
        },
        username: {
            type: DataTypes.STRING,
            unique: true
        },
        password: {
            type: DataTypes.STRING,
            unique: false
        }
    },
    {
        sequelize,
        modelName: "user",
        timestamps: false
    }
);