import dotenv from "dotenv";
dotenv.config();

import app from "./app";

const PORT = process.env.PORT || 5000;

console.log("cwd:", process.cwd());
console.log("SUPABASE_URL loaded:", !!process.env.SUPABASE_URL);
console.log("SUPABASE_SERVICE_ROLE_KEY loaded:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log("JWT_SECRET loaded:", !!process.env.JWT_SECRET);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
