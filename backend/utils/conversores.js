import { mongoose, ObjectId } from './libs.js';

const convertirObjectId = (v) => {
    if (v === null || v === undefined) return v;
    if (v instanceof Date) return v;
    if (v instanceof ObjectId || (v && v._bsontype === "ObjectId") || (v && v instanceof mongoose.Types.ObjectId)) {
        return v.toString();
    }
    // New check for buffer-style ObjectIds (common in IPC/Serialized data)
    if (v && typeof v === "object" && v.buffer && (v.buffer instanceof Uint8Array || Array.isArray(v.buffer) || (typeof v.buffer === 'object' && v.buffer[0] !== undefined)) && (v.buffer.length === 12 || (Object.keys(v.buffer).length === 12))) {
        try {
            const buf = (v.buffer instanceof Uint8Array || Array.isArray(v.buffer)) 
                ? v.buffer 
                : Uint8Array.from(Object.values(v.buffer));
            return new mongoose.Types.ObjectId(buf).toString();
        } catch (e) {
            // If not a valid buffer for ObjectId, continue
        }
    }
    if (Array.isArray(v)) return v.map(convertirObjectId);
    if (v && typeof v === "object") {
        // Special check: Is this the binary-serialized object itself (not wrapped in 'buffer')?
        if (v['0'] !== undefined && v['11'] !== undefined && Object.keys(v).length === 12) {
            try {
                return new mongoose.Types.ObjectId(Uint8Array.from(Object.values(v))).toString();
            } catch (e) {}
        }

        const newV = { ...v };
        if (newV._id) {
            newV._id = convertirObjectId(newV._id);
            if (typeof newV._id === 'string') newV.id = newV._id;
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