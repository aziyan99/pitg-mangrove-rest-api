import { Model, DataTypes } from "sequelize";
import sequelize from "../dbconfig.js";


export class Mangrove extends Model {}

Mangrove.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true
        },
        dataId: {
            type: DataTypes.INTEGER,
            unique: true
        },
        name: {
            type: DataTypes.STRING,
            unique: false
        },
        image: {
            type: DataTypes.STRING,
            unique: false
        },
        description: {
            type: DataTypes.TEXT,
            unique: false
        }
    },
    {
        sequelize,
        modelName: "mangrove",
        timestamps: false
    }
);