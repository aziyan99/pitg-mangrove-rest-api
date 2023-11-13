import { Model, DataTypes } from "sequelize";
import sequelize from "../dbconfig.js";


export class Config extends Model {}

Config.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true
        },
        key: {
            type: DataTypes.STRING,
            unique: true
        },
        value: {
            type: DataTypes.TEXT,
        },
        input: {
            type: DataTypes.STRING,
            unique: false
        }
    },
    {
        sequelize,
        modelName: "config",
        timestamps: false
    }
);