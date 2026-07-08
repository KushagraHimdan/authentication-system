import app from "./src/app.js";
import connectDB from "./src/config/database.js";

connectDB();

app.listen(3000, () => {
    console.log(`App is running on port 3000`);
    
});