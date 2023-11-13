import express from "express";
import multer, { memoryStorage } from "multer";
import sharp from "sharp";
import { node, loadLayersModel, argMax } from "@tensorflow/tfjs-node";
import swaggerJsdoc from "swagger-jsdoc";
import { serve, setup } from "swagger-ui-express";
import cors from "cors";
import "dotenv/config";
import { CLASS_LABELS } from "./labels.js";
import { Mangrove } from "./models/mangrove.js";
import sequelize from "./dbconfig.js";
import bodyParser from "body-parser";
import { User } from "./models/user.js";
import bcrypt from 'bcrypt';
import { Config } from "./models/config.js";
import path from 'path';
import session from "express-session";
import { fileURLToPath } from 'url';

const app = express();
const port = process.env.PORT || 3000;
const modelPath = process.env.MODEL_URL;
const storage = memoryStorage();
const upload = multer({ storage: storage });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swaggerOptions = {
  swaggerDefinition: {
    info: {
      title: "Image Prediction API",
      version: "1.0.0",
      description: "API for predicting class labels of mangrove image",
    },
  },
  apis: ["index.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api/swagger", serve, setup(swaggerSpec));

app.use(cors());
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, "statics")));
app.use(session({
  name: 'LOGIN_ID',
  secret: process.env.SECRET || 'secret',
  cookie: {
    maxAge: 2 * 86400000, // 2 days
  }
}));


/**
 * @swagger
 * /api/v1/predict:
 *   post:
 *     summary: Predict the class label of an uploaded mangrove image.
 *     tags:
 *       - Prediction
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - name: image
 *         in: formData
 *         type: file
 *         description: The image file to predict.
 *     responses:
 *       200:
 *         description: Successfully predicted the class label.
 *         schema:
 *           type: object
 *           properties:
 *             dataId:
 *               type: number
 *               description: The predicted data id.
 *               default: 1
 *             name:
 *               type: string
 *               description: The predicted class label.
 *               default: Mangrove A
 *             image:
 *               type: string
 *               description: The selected mangrove image.
 *               default: https://sample
 *             description:
 *               type: string
 *               description: The descriptions.
 *               default: Mangrove A is Foo Bar of Bazz
 *       500:
 *         description: Internal server error.
 */
app.post("/api/v1/predict", upload.single("image"), async (req, res) => {
  try {
    const buffer = req.file.buffer;
    const imageBuffer = await sharp(buffer)
      .resize(150, 150)
      .removeAlpha()
      .toBuffer();

    const decodedImage = node.decodeImage(imageBuffer, 3);
    const normalizedImage = decodedImage.div(255.0);
    const reshapedImage = normalizedImage.reshape([1, 150, 150, 3]);

    const model = await loadLayersModel(modelPath);
    const predictions = model.predict(reshapedImage);
    const predictionValues = predictions.dataSync();
    predictions.dispose();
    reshapedImage.dispose();

    const predictedClassIdx = argMax(predictionValues).dataSync()[0];
    const classNames = Object.keys(CLASS_LABELS);
    const predictedClassName = classNames[predictedClassIdx];

    const mangrove = await Mangrove.findOne({where: {dataId: predictedClassIdx}});

    res.json({
      dataId: predictedClassIdx,
      name: mangrove.getDataValue('name'),
      image: mangrove.getDataValue('image'),
      description: mangrove.getDataValue('description'), 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/v1/configs:
 *   get:
 *     summary: Get configurations data.
 *     tags:
 *       - Config
 *     responses:
 *       200:
 *         description: Successfully get configs data.
 *         schema:
 *           type: object
 *           properties:
 *             key:
 *               type: string
 *               description: The pair of key-value from configs data.
 *               default: 'value'
 *       500:
 *         description: Internal server error.
 */
app.get("/api/v1/configs", async (req, res) => {
  try {

    const configs = await Config.findAndCountAll();
    const configsObj = {};
    configs.rows.forEach(config => {
      configsObj[config.getDataValue('key')] = config.getDataValue('value')
    });

    res.json(configsObj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/login", async (req, res) => {
  if (req.session.userId) {
    res.redirect('/');
  }

  res.render("login");
});

app.post("/login", async (req, res) => {
  if (req.session.userId) {
    res.redirect('/');
  }
  
  const user = {
    username: req.body.username,
    password: req.body.password
  }

  const selectedUser = await User.findOne({where: {username: user.username}});
  if (selectedUser === null) {
    res.redirect('/login');
  }

  if (!bcrypt.compareSync(user.password, selectedUser.password)) {
    res.redirect('/login');
  }

  req.session.userId = selectedUser.getDataValue('id');
  res.redirect("/");
});

app.get("/logout", (req, res) => {
  if (req.session.userId) {
    delete req.session.userId;
    res.redirect("/login");
  }

  res.redirect("/login");
});


app.get("/", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  res.render("dashboard/index");
});

app.get("/users", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  const users = await User.findAndCountAll();
  res.render("users/index", {users: users.rows, count: users.count});
});

app.post("/users", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  
  const salt = bcrypt.genSaltSync(10);
  const user  = {
    username: req.body.username,
    password: bcrypt.hashSync(req.body.password, salt),
  };
  User.create(user);
  res.redirect('/users');
});

app.get("/mangroves", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  
  const mangroves = await Mangrove.findAndCountAll();
  res.render("mangroves/index", {mangroves: mangroves.rows, count: mangroves.count});
});

app.get("/users/create", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  
  res.render("users/create");
});

app.post("/users/:id/delete", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  
  const user = await User.findByPk(req.params['id']);
  user.destroy();
  res.redirect('/users');
});

app.post("/mangroves", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  
  const mangrove  = {
    name: req.body.name,
    dataId: req.body.dataId,
    image: req.body.image,
    description: req.body.description,
  };
  const existingMangrove = await Mangrove.findOne({where: {dataId: mangrove.dataId}});
  if (existingMangrove === null) {
    await Mangrove.create(mangrove);
  }
  res.redirect('/mangroves');
});

app.get("/mangroves/create", (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  
  res.render("mangroves/create");
});

app.get("/mangroves/:id/edit", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  
  const mangrove = await Mangrove.findByPk(req.params['id']);
  res.render("mangroves/edit", {mangrove: mangrove});
});

app.post("/mangroves/:id/edit", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  
  const mangrove = await Mangrove.findByPk(req.params['id']);
  mangrove.update({
    name: req.body.name,
    dataId: req.body.dataId,
    image: req.body.image,
    description: req.body.description
  });
  res.redirect('/mangroves');
});

app.post("/mangroves/:id/delete", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  
  const mangrove = await Mangrove.findByPk(req.params['id']);
  mangrove.destroy();
  res.redirect('/mangroves');
});

app.get("/configs", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  
  const configs = await Config.findAndCountAll();
  res.render('configs/index', {configs: configs.rows});
});

app.post("/configs", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  
  const configs = await Config.findAndCountAll();
  configs.rows.forEach(async config => {
    if (req.body[config.dataValues['key']]) {
      let selectedConfig = await Config.findOne({where: {key: config.dataValues['key']}});
      selectedConfig.update({value: req.body[config.dataValues['key']]});
    }
  });
  res.redirect('/configs');
});

sequelize.sync().then(() => {
  const user = {
    username: "admin",
    password: bcrypt.hashSync("admin", bcrypt.genSaltSync(10))
  };
  User.findOrCreate({where: {username: user.username}, defaults: {password: user.password}});
  
  const configs = [
    {key: "about", value: "Foo", input: 'textarea'},
    {key: "about_banner", value: "https://sample", input: 'text'},
    {key: "help", value: "Bar", input: 'textarea'},
    {key: "help_banner", value: "https://sample", input: 'text'},
    {key: "tfjs_model_uri", value: "https://aziyan99.github.io/202310221831tfjs/model.json", input: 'text'},
  ];

  configs.forEach(async config => {
    const existingConfig = await Config.findOne({where: {key: config.key}});
    if (existingConfig === null) {
      Config.create(config);
    }
  });

  const mangroves = [
    {dataId: 0, name: 'Avicennia alba', image: '-', description: '-'},
    {dataId: 1, name: 'Bruguiera cylindrica', image: '-', description: '-'},
    {dataId: 2, name: 'Bruguiera gymnorrhiza', image: '-', description: '-'},
    {dataId: 3, name: 'Lumnitzera littorea', image: '-', description: '-'},
    {dataId: 4, name: 'Rhizophora apiculata', image: '-', description: '-'},
    {dataId: 5, name: 'Rhizophora mucronata', image: '-', description: '-'},
    {dataId: 6, name: 'Sonneratia alba', image: '-', description: '-'},
    {dataId: 7, name: 'Xylocarpus granatum', image: '-', description: '-'},
  ];

  mangroves.forEach(async mangrove => {
    const existingMangrove = await Mangrove.findOne({where: {dataId: mangrove.dataId}});
    if (existingMangrove === null) {
      Mangrove.create(mangrove);
    }
  });
  
  console.log("[sequelize] DB ready");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
