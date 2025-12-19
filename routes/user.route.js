const express = require("express");
const router = express.Router();
const User = require("../models/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const {uploadFile} = require('../middleware/upload-file');

var transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});




require('dotenv').config();
// créer un nouvel utilisateur
router.post('/register', async (req, res) => {
  try {
    let { email, password, firstname, lastname } = req.body;
    const user = await User.findOne({ email });
    if (user)
      return res
        .status(404)
        .send({ success: false, message: "User already exists" });

    const newUser = new User({ email, password, firstname, lastname });
    const createdUser = await newUser.save();
    
    // Envoyer l'e-mail de confirmation de l'inscription
    var mailOption = {
      from: `"Verify your email" <${process.env.EMAIL_USER}>`,
      to: newUser.email,
      subject: "Verify your email",
      html: `<h2>${newUser.firstname}! Thank you for registering on our website</h2>
<h4>Please verify your email to proceed...</h4>
<a href="http://${req.headers.host}/api/users/status/edit?email=${newUser.email}">Click here to verify</a>`,
    };
    
    transporter.sendMail(mailOption, function (error, info) {
      if (error) {
        console.log("Email error:", error);
      } else {
        console.log("Verification email sent:", info.response);
      }
    });
    
    return res
      .status(201)
      .send({
        success: true,
        message: "Account created successfully. Please check your email to verify your account.",
        user: createdUser,
      });
  } catch (err) {
    console.log(err);
    res.status(404).send({ success: false, message: err.message });
  }
});

// as an admin i can disable or enable an account (also used for email verification)
router.get('/status/edit/', async (req, res) => {
  try {
    let email = req.query.email;
    console.log("Verifying email:", email);
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send({ success: false, message: "User not found" });
    }
    user.isActive = !user.isActive;
    await user.save();
    res.status(200).send(`
      <h1>Email Verified Successfully!</h1>
      <p>Your account is now active. You can close this window and login.</p>
    `);
  } catch (err) {
    console.log(err);
    return res.status(404).send({ success: false, message: err.message });
  }
});

// afficher la liste des utilisateurs.
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// se connecter
router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(404).send({ success: false, message: "All fields are required" });
    }

    let user = await User.findOne({ email }).select('+password').select('+isActive');

    if (!user) {
      return res.status(404).send({ success: false, message: "Account doesn't exists" });
    } else {
      let isCorrectPassword = await bcrypt.compare(password, user.password);
      if (isCorrectPassword) {
        delete user._doc.password;
        if (!user.isActive) return res.status(200).send({ success: false, message: 'Your account is inactive, Please contact your administrator' });

        const token = generateAccessToken({ _id: user._id, role: user.role });
        const refreshToken = generateRefreshToken({ _id: user._id, role: user.role });

        return res.status(200).send({ success: true, user, token, refreshToken });
      } else {
        return res.status(404).send({ success: false, message: "Please verify your credentials" });
      }
    }
  } catch (err) {
    return res.status(404).send({ success: false, message: err.message });
  }
});

// Access Token
const generateAccessToken = (user) => {
  return jwt.sign({ iduser: user._id, role: user.role }, process.env.SECRET, {
    expiresIn: '60s'
  });
};

// Refresh Token
function generateRefreshToken(user) {
  return jwt.sign({ iduser: user._id, role: user.role }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: '1y'
  });
}

// Refresh Route
router.post('/refreshToken', async (req, res) => {
  console.log(req.body.refreshToken);
  const refreshtoken = req.body.refreshToken;
  if (!refreshtoken) {
    return res.status(404).send({ success: false, message: 'Token Not Found' });
  } else {
    jwt.verify(refreshtoken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
      if (err) {
        console.log(err);
        return res.status(406).send({ success: false, message: 'Unauthorized' });
      } else {
        const token = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        console.log("token-------", token);
        res.status(200).send({
          success: true,
          token,
          refreshToken
        });
      }
    });
  }
})
router.get("/getallusers", async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});
router.post("/getuserbyname", async (req, res) => {
  try {
    const { firstname } = req.body;
    if (!firstname) {
      return res.status(400).json({ message: "Le nom est requis" });
    }
    const user = await User.findOne({ firstname: firstname });
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


module.exports = router;