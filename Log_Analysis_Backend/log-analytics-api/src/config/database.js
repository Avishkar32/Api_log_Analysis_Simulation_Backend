const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb+srv://anujgosavi2005:Anuj%40123@cluster0.jwl136g.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
    console.log("📦 MongoDB Connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

module.exports = connectDB;
