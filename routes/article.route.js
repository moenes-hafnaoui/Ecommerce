const express = require("express");
const router = express.Router();
const Article = require("../models/article");
const Scategorie = require("../models/scategorie");
const { verifyToken } = require("../middleware/verify-token");
const { authorizeRoles } = require("../middleware/authorizeRoles");

// afficher la liste des articles - NO AUTH for MCP
router.get("/", async (req, res) => {
  try {
    const articles = await Article.find({}, null, { sort: { _id: -1 } })
      .populate("scategorieID")
      .exec();
    res.status(200).json(articles);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// créer un nouvel article - KEEP AUTH
const { uploadFile } = require("../middleware/upload-file");
router.post(
  "/",
  verifyToken,
  uploadFile.single("imageart"),
  async (req, res) => {
    try {
      const { reference, designation, prix, marque, qtestock, scategorieID } =
        req.body;
      const imageart = req.file ? req.file.filename : null;
      const nouvarticle = new Article({
        reference,
        designation,
        prix,
        marque,
        qtestock,
        scategorieID,
        imageart,
      });
      await nouvarticle.save();
      res.status(200).json(nouvarticle);
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }
);

// afficher la liste des articles par page - NO AUTH for MCP
router.get("/pagination", async (req, res) => {
  const page = req.query.page || 1;
  const limit = req.query.limit || 5;
  const offset = (page - 1) * limit;
  try {
    const articlesTot = await Article.countDocuments();
    const articles = await Article.find({}, null, { sort: { _id: -1 } })
      .skip(offset)
      .limit(limit);
    res.status(200).json({ articles: articles, tot: articlesTot });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// chercher un article - NO AUTH for MCP
router.get("/:articleId", async (req, res) => {
  try {
    const art = await Article.findById(req.params.articleId);
    res.status(200).json(art);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// modifier un article - KEEP AUTH
router.put("/:articleId", verifyToken, async (req, res) => {
  try {
    const art = await Article.findByIdAndUpdate(
      req.params.articleId,
      { $set: req.body },
      { new: true }
    );
    const articles = await Article.findById(art._id)
      .populate("scategorieID")
      .exec();
    res.status(200).json(articles);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// Supprimer un article - KEEP AUTH
router.delete("/:articleId", verifyToken, async (req, res) => {
  const id = req.params.articleId;
  await Article.findByIdAndDelete(id);
  res.json({ message: "article deleted successfully." });
});

// chercher un article par s/cat - NO AUTH for MCP
router.get("/scat/:scategorieID", async (req, res) => {
  try {
    const art = await Article.find({
      scategorieID: req.params.scategorieID,
    }).exec();
    res.status(200).json(art);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// chercher un article par cat - NO AUTH for MCP
router.get("/cat/:categorieID", async (req, res) => {
  try {
    const sousCategories = await Scategorie.collection
      .find({ categorieID: req.params.categorieID })
      .toArray();
    const sousCategorieIDs = sousCategories.map((scategorie) => scategorie._id);
    const articles = await Article.find({
      scategorieID: { $in: sousCategorieIDs },
    }).exec();
    res.status(200).json(articles);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

module.exports = router;
