const mongoose = require("mongoose");
const Categorie = require("./scategorie.js");
const scategorieSchema = mongoose.Schema({
    reference:{ type: String, required: true,unique:true },
designation:{ type: String, required: true,unique:true },
prix:{ type: Number, required: false },
marque:{ type: String, required: true },
qtestock:{ type: Number, required: false },
imageart:{ type: String, required: false },
scategorieID: {type:mongoose.Schema.Types.ObjectId,
ref:"scategorie"}
})
module.exports = mongoose.model("article", scategorieSchema);