const axios = require('axios');
require('dotenv').config();

async function run() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
  
  try {
    const response = await axios.get(url);
    console.log("SUCCESS:");
    console.log(response.data.models.map(m => m.name));
  } catch (err) {
    console.error("ERROR:");
    console.error(err.response ? err.response.data : err.message);
  }
}
run();
