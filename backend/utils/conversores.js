import { mongoose, ObjectId } from './libs.js';

const convertirObjectId = (v) => {
    if (v === null || v === undefined) return v;
    if (v instanceof Date) return v;
    if (v instanceof ObjectId || (v && v._bsontype === "ObjectId") || (v && v instanceof mongoose.Types.ObjectId)) {
        return v.toString();
    }
    if (Array.isArray(v)) return v.map(convertirObjectId);
    if (v && typeof v === "object") {
        // Create a shallow copy to avoid modifying the original object in place
        const newV = { ...v };
        if (newV._id) {
            const idStr = newV._id.toString();
            newV.id = idStr;
            newV._id = idStr;
        }
        for (const k in newV) {
            if (k !== "_id") {
                newV[k] = convertirObjectId(newV[k]);
            }
        }
        return newV;
    }
    return v;
};

export {
    convertirObjectId,
};