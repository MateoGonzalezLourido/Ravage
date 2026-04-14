
import { app } from './backend/utils/libs.js';
console.log("App proxy created.");
try {
    console.log("Attempting to call app.getPath('downloads')...");
    const path = app.getPath("downloads");
    console.log("Success:", path);
} catch (err) {
    console.error("CRACHEADO:");
    console.error(err);
}
