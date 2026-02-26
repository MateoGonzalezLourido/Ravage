const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto")

const { getIdDispositivo, getCorreoSesion, getUsuariosBloqueados, getUsuariosSilence, setUsuariosBloqueados, setUsuariosSilence, setFechaBloqueoContraseña, setFechaBloqueoCorreo, setApodoSesion, setFechaBloqueoApodo, getIDMongodbUsuario } = require('../STORAGE/Variables_sesion.js')
const { validateToken } = require('../services/CreadorTokens.js')

//esquemas de datos
//subesquemas
const ChatUsuarioSchema = new mongoose.Schema({
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    grupo: { type: Boolean, default: false },
    ultimoCambio: { type: Date, default: Date.now },
    ultimomensaje: { type: String, default: "" },
    fijado: { type: Boolean, default: false }
}, { _id: false });
const ContactoUsuarioSchema = new mongoose.Schema({
    id: { type: mongoose.Schema.Types.ObjectId, required: true },
    apodo: { type: String, default: "", maxlength: 30 }
}, { _id: false });
const UserSchema = new mongoose.Schema({
    apodo: {//es el nombre que se te pondra si otro usaurio no te tiene de contacto con su nombre propio
        type: String,
        required: true,
        minlength: 3,
        maxlength: 30,
        trim: true,
        default: "Usuario",
        match: /^[a-zA-Z0-9_-]+$/
    },
    correo: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        trim: true,
        minlength: 2,
        maxlength: 255
    },
    contrasena: {//solo para iniciar sesion
        type: String,
        required: true,
        minlength: 5,
        trim: true,
    },
    exp_bloq_apodo: {//tiempo que tienes que esperar para cambiar de apodo
        type: Date,
        default: () => new Date(Date.now() + 1 * 60 * 60 * 1000) // 1 hora después
    },
    exp_bloq_correo: {//tiempo que tienes que esperar para cambiar el correo
        type: Date,
        default: () => new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 horas después
    },
    exp_bloq_contrasena: {//tiempo que tienes que esperar para cambiar la cotnraseña
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas después
    },
    users_bloq: {//chats que tienes bloqueados
        type: [mongoose.Schema.Types.ObjectId],
        default: []
    },
    users_silence: {//chats que tienes silenciados
        type: [mongoose.Schema.Types.ObjectId],
        default: []
    },
    contactos: {//acceso rapido a los contactos del usuario (se podria mover de aqui si la aplicacion crece mucho)
        type: [ContactoUsuarioSchema],
        default: []
    },
    chats: {//un acceso rapido a los chats del usuario
        type: [ChatUsuarioSchema],
        default: []
    },
    visible: {//esto te oculta por completo hacia otros usuarios (tampoco te peuden meter en chats ... pero si recibir menasjes de chats ya creados, solo que no ven que los lees ni nada)
        type: Boolean,
        default: true
    },
    mostrarCorreo: {//esto oculta por completo tu correo 
        type: Boolean,
        default: true
    },
    bloqueada: {//!esto hay que moverlo de aqui (sirve para bloquear la cuenta)
        type: Boolean,
        default: false
    },
    bloquearChatsNuevos: {//esto permite que no te añadan a nuevos chats sin usar "visible"
        type: Boolean,
        default: false
    },
    idamigo: {//sustituye el correo a la ahora de crear chats y contactos
        type: String,
        default: "",
        required: true,
        unique: true
    },
    secretKey: {//key para cifrador los archivos en local de cada usuario
        type: String,
        default: ""
    },
    createdAt: { type: Date, default: Date.now }//fecha de creacion de cuenta
})
//esquemas principales
const ValidationCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true
    },
    correo: {
        type: String,
        required: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    expira: {
        type: Date,
        default: () => new Date()
    },
    id_dp: {
        type: String,
        required: true,
        default: ""
    }
})
const DatosCuentaValidationCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        minlength: 6
    },
    correo: {
        type: String,
        required: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    tipo: {
        type: String,
        required: true,
        lowercase: true
    },
    expira: {
        type: Date,
        default: () => new Date()
    },
    id_dp: {
        type: String,
        required: true,
        default: ""
    }
})
const ActiveUserSchema = new mongoose.Schema({
    correo: {
        type: String,
        required: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    expira: {
        type: Date,
        default: () => new Date()
    },
    id_dp: {
        type: String,
        required: true,
        default: "",
    }
})
const TokenSchema = new mongoose.Schema({
    correo: {
        type: String,
        required: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    token: {
        type: String,
        required: true,
        default: ""
    },
    expira: {
        type: Date,
        default: () => new Date()
    },
    id_dp: {
        type: String,
        required: true,
        default: ""
    }
})
const TokenDPCSchema = new mongoose.Schema({
    correo: {
        type: String,
        required: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    token: {
        type: String,
        required: true,
        default: ""
    },
    id_dp: {
        type: String,
        required: true,
        default: ""
    }
})
const DPBLOQUEADOSchema = new mongoose.Schema({
    correo: {
        type: String,
        required: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    id_dp: {
        type: String,
        required: true,
        default: ""
    }
})
const EntradaSchema = new mongoose.Schema({
    tipo: { type: String, required: true },   // tipo de entrada, p.ej. "archivo", "mensaje"
    data: { type: mongoose.Schema.Types.Mixed, required: true } // cualquier estructura de datos
})
const ChatSchema = new mongoose.Schema({
    nombre: {//solo si es un grupo (si es de dos se coje el apodo que le tengas a ese usuario)
        type: String,
        default: ""
    },
    usuarios: {
        type: [mongoose.Schema.Types.ObjectId],
        default: []
    },
    grupo: {
        type: Boolean,
        default: false
    },
    mensajes: {
        type: [
            {
                emisor: { type: [mongoose.Schema.Types.ObjectId], required: true },
                contenido: {
                    type: [{
                        asunto: { type: String, default: "" },
                        nombre_file: { type: String, default: "_archivo_" },
                        id_file: { type: String, default: "" }
                    }]
                },
                data: { type: Date, default: Date.now }
            }
        ],
        default: []
    }
})
const BuzonSchema = new mongoose.Schema({
    correo: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        trim: true,
        minlength: 2,
        maxlength: 255
    },
    entrada: [EntradaSchema]
})

//expiracion codigos y tokens
TokenSchema.index({ expira: 1 }, { expireAfterSeconds: 90 * 60 });//90minutos
ValidationCodeSchema.index({ expira: 1 }, { expireAfterSeconds: 10 * 60 });//10minutos
ActiveUserSchema.index({ expira: 1 }, { expireAfterSeconds: 5 * 60 });//5minutos
DatosCuentaValidationCodeSchema.index({ expira: 1 }, { expireAfterSeconds: 10 * 60 });//10minutos
//las tablas de datos de mondo db  
const User = mongoose.model("User", UserSchema, "usuarios");
const ValidationCode = mongoose.model("ValidationCodes", ValidationCodeSchema, "validationcodes");
const CuentaValidationCode = mongoose.model("CuentaValidationCode", ValidationCodeSchema, "cuentavalidationcode");
const DatosCuentaVC = mongoose.model("datoscuentavc", DatosCuentaValidationCodeSchema, "datoscuentavc");
const ActiveUser = mongoose.model("ActiveUser", ActiveUserSchema, "usuariosactivos");
const TokenSession = mongoose.model("tksession", TokenSchema, "tksession");
const TokenVC = mongoose.model("tokenvcv", TokenSchema, "tokenvcv");
const TokenDPC = mongoose.model("tokendpc", TokenDPCSchema, "tokendpc");
const DispositivosBloqueados = mongoose.model("dpbloqueados", DPBLOQUEADOSchema, "dpbloqueados");
const ChatsRavage = mongoose.model("chats", ChatSchema, "chats");
const BuzonUsuarios = mongoose.model("buzonsusuarios", BuzonSchema, "buzonusuarios");

//conectar db
async function connectDB() {
    //conectar db ; no se pueden poner comprobaciones de si esta conectado al iniciar la app porque tarda mucho y falla si no lo esta
    await mongoose.connect(process.env.URI_MONGODB, {
        tls: true,                          //usar tls
        tlsInsecure: false,                 // verifica certificados
        serverSelectionTimeoutMS: 5000,     //lo que puede tardar maximo
        socketTimeoutMS: 45000
    })
        .then(() => console.log("(+) Conectado a MongoDB Atlas"))
        .catch(() => console.error("(-) Error de conexión"));
}
//cerrar db
async function closeDB() {
    if (!estaConectado) return;
    await mongoose.disconnect();
    console.warn("(-) Cerrado MongoDB");
}
//comprobar si esta conectado
function estaConectado() {
    return mongoose.connection.readyState !== 0;
}

//reconectar mongo si cae
mongoose.connection.on('disconnected', () => {
    console.warn('(-) MongoDB desconectado.');
});
//loging usuario
async function LoginUsuarioDB({ correo = null, contraseña = null, token = null, id_dp = null, bloqueada = false }) {
    try {
        if (token && correo && id_dp) {//validar por token + correo
            //token de validacion de sesion
            let token_valido = validateToken(token);
            if (!token_valido) {//token no valido
                LimpiarJWTUsuario(correo, token)//limpiar token de mongodb (si existe)
                console.error("Token invalido o expirado")
                return { success: false };
            }

            //verificar si mongodb tiene ese token
            const tokenhash = crypto.createHash("sha256").update(token).digest("hex");
            const token_datos = await TokenSession.exists({ correo, token: tokenhash, id_dp })

            if (!token_datos) {
                console.error("Token invalido o expirado")
                return { success: false };
            }

            //obtener usuario+datos
            const usuario_datos = (await User.find({ correo, bloqueada }).limit(1))[0]
            if (!usuario_datos || usuario_datos == [] || usuario_datos.length == 0) {
                console.error("LOG, NO SE HAN ENCONTRADO DATOS DEL USUARIO")
                return { success: false }
            }
            //sesion iniciada
            return { success: true, data: usuario_datos }
        }
        //log por correo y contraseña
        if (!correo || !contraseña) {
            console.error("Faltan datos para iniciar sesión");
            return { success: false };
        }
        //validar por credenciales correo + contraseña
        const usuario_datos = (await User.find({ correo, bloqueada }).limit(1))[0];
        if (!usuario_datos || usuario_datos == [] || (usuario_datos.length == 0)) {
            console.error("Credenciales incorrectas");
            return { success: false }
        }
        //comparar contraseña del usuario con la de la base de datos
        const ok = await bcrypt.compare(contraseña, usuario_datos.contrasena);
        if (!ok) {
            console.error("Credenciales incorrectas");
            return { success: false }
        }
        //sesion iniciada
        console.log(`Datos de usuario obtenidos: ${usuario_datos.apodo}`)
        return { success: true, data: usuario_datos }
    } catch (e) {
        console.error(e);
        return { success: false };
    }
}
//instertar datos
async function InsertarUsuario({ apodo = "Usuario", contraseña, correo }) {//la contraseña ya biene hasheada
    if (apodo == "") apodo = "Usuario"
    if (!contraseña || !correo) throw new Error("Faltan datos para insertar usuario");
    const key = await ActualizarSecretKeyUsuario(false)
    //crear id amigo
    function generarIdAmigo() {
        return crypto.randomBytes(8).toString("hex").toUpperCase()
    }
    let idamigo = ""
    let existe = true
    while (existe) {
        idamigo = generarIdAmigo()
        existe = await User.exists({ idamigo: idamigo })
    }
    try {
        const r = await User.create({
            apodo: apodo,
            correo: correo,
            contrasena: contraseña,
            secretKey: key,
            idamigo: idamigo
        });
        console.log("Usuario insertado correctamente");
        return true
    } catch (e) {
        console.error(e)
        return null
    }
}
async function InsertarVC({ correo = null, code = null, id = "" }) {
    if (!correo || !code) throw new Error("Faltan datos para insertar codigo");

    const codehash = crypto.createHash("sha256").update(code).digest("hex");

    try {
        const r = await ValidationCode.create({
            code: codehash,
            correo: correo,
            id_dp: id
        });

        console.log("Codigo insertado correctamente");
        return true
    } catch (e) {
        console.error(e)
        return null
    }
}
async function InsertarCuentaVC({ correo = null, code = null, id = "" }) {
    if (!correo || !code) throw new Error("Faltan datos para insertar codigo");

    const codehash = crypto.createHash("sha256").update(code).digest("hex");

    try {
        const r = await CuentaValidationCode.create({
            code: codehash,
            correo: correo,
            id_dp: id
        });

        console.log("Codigo insertado correctamente");
        return true
    } catch (e) {
        console.error(e)
        return null
    }
}
async function InsertarDatosCuentaVC({ correo = null, code = null, id = "", tipo = "" }) {
    if (!correo || !code) {
        console.error("Faltan datos para insertar codigo")
        return null
    }
    try {
        await DatosCuentaVC.create({
            code: code,
            correo: correo,
            id_dp: id,
            tipo: tipo
        });

        console.log("Codigo insertado correctamente");
        return true
    } catch (e) {
        console.error(e)
        return null
    }
}
async function ActualizarUsuarioActivo({ correo = null }) {
    if (!correo) {
        console.error("Faltan datos para insertar usuario activo")
        return null
    }
    const deviceId = getIdDispositivo()
    //esto lo crea si no existe
    try {
        const nuevoUsuarioActivo = await ActiveUser.updateOne(
            { correo, id_dp: deviceId },
            { $set: { expira: new Date() } },
            { upsert: true }
        );

        return nuevoUsuarioActivo
    } catch (e) {
        console.error(e)
        return null
    }
}
async function añadirUsuariosBloqueados(id, apodo) {
    const correo = getCorreoSesion()
    let lista_bloqueados = getUsuariosBloqueados()
    const index = lista_bloqueados.findIndex(sub => sub.includes(id))
    if (index != -1) return false //ya existe

    lista_bloqueados.push([id, apodo])

    try {
        const r = await User.updateOne(
            { correo: correo },//filtro
            {
                $set: {
                    users_bloq: lista_bloqueados
                }
            },
            { upsert: true }
        )
        if (r.matchedCount === 0) return false; // correo no encontrado

        setUsuariosBloqueados(lista_bloqueados)
        return true
    } catch (e) {
        console.error(e)
        return null
    }
}
async function añadirUsuariosSilenciados(id, apodo) {
    const correo = getCorreoSesion()
    let lista_silenciados = getUsuariosSilence()
    const index = lista_silenciados.findIndex(sub => sub.includes(id))
    if (index != -1) return false //ya existe

    lista_silenciados.push([id, apodo])

    try {
        const r = await User.updateOne(
            { correo: correo },//filtro
            {
                $set: {
                    users_silence: lista_silenciados
                }
            },
            { upsert: true }
        )
        if (r.matchedCount === 0) return false; // correo no encontrado

        setUsuariosBloqueados(lista_silenciados)
        return true
    } catch (e) {
        console.error(e)
        return null
    }
}
//borrar datos
async function BorrarVC(correo) {
    await ValidationCode.deleteMany({ correo: correo });
}
async function BorrarCuentaVC(correo) {
    await CuentaValidationCode.deleteMany({ correo: correo });
}
async function BorrarDatosCuentaVC(correo, code) {
    await DatosCuentaVC.deleteMany({ correo: correo, code: code });
}

async function BorrarUsuarioActivo() {
    if (!estaConectado) return;

    const deviceId = getIdDispositivo()
    await ActiveUser.deleteOne({ id_dp: deviceId })
}
async function eliminarUsuariosBloqueados(id) {
    const correo = getCorreoSesion()
    let lista_bloqueados = getUsuariosBloqueados()
    const index = lista_bloqueados.findIndex(sub => sub.includes(id))
    if (index === -1) return false

    lista_bloqueados.splice(index, 1)
    try {
        const r = await User.updateOne(
            { correo: correo },//filtro
            {
                $set: {
                    users_bloq: lista_bloqueados
                }
            },
            { upsert: true }
        )
        if (r.matchedCount === 0) return false; // correo no encontrado
        setUsuariosBloqueados(lista_bloqueados)
        return true
    } catch (e) {
        console.error(e)
        return null
    }
}
async function eliminarUsuariosSilenciados(id) {
    const correo = getCorreoSesion()
    let lista_silenciados = getUsuariosBloqueados()
    const index = lista_silenciados.findIndex(sub => sub.includes(id))
    if (index === -1) return false

    lista_silenciados.splice(index, 1)

    try {
        const r = await User.updateOne(
            { correo: correo },//filtro
            {
                $set: {
                    users_silence: lista_silenciados
                }
            },
            { upsert: false }
        )
        if (r.matchedCount === 0) return false; // correo no encontrado

        setUsuariosSilence(lista_silenciados)
        return true
    } catch (e) {
        console.error(e)
        return null
    }
}
//añadir tokens (no rompen nada si fallan)
async function AñadirJWTUsuario(correo, token = "") {
    //exìra en 7dias, expira= (7dias - 90min del expire de mongo)
    const tokenhash = crypto.createHash("sha256").update(token).digest("hex");
    const deviceId = getIdDispositivo()

    await TokenSession.create({
        correo,
        token: tokenhash,
        expira: new Date(Date.now() + ((7 * 24 * 60 * 60 * 1000) - (90 * 60 * 1000))),
        id_dp: deviceId
    });

}
async function AñadirJWTUsuarioVC(correo, token = "") {
    //exìra en 90min
    const tokenhash = crypto.createHash("sha256").update(token).digest("hex");
    const deviceId = getIdDispositivo()

    await TokenVC.create({
        correo,
        token: tokenhash,
        expira: new Date(Date.now()),
        id_dp: deviceId
    });
}
//TODO: usarlo
async function AñadirJWTDPConfianza(correo, token = "") {
    //exìra en 90min
    const tokenhash = crypto.createHash("sha256").update(token).digest("hex");
    const deviceId = getIdDispositivo()

    await TokenDPC.create({
        correo,
        token: tokenhash,
        id_dp: deviceId
    })
}
//limpiar tokens
async function LimpiarJWTUsuario(correo, token = null) {
    if (!token) try { await TokenVC.deleteMany({ correo: correo }) } catch (e) { throw e }//borra todos (por segurida)
    else try { await TokenSession.deleteMany({ correo: correo, token: token }) } catch (e) { throw e }//borra ese solo
}
async function LimpiarJWTUsuarioVC(correo, token = null) {
    if (!token) try { await TokenVC.deleteMany({ correo: correo }) } catch (e) { throw e }
    else try { await TokenVC.deleteMany({ correo: correo, token: token }) } catch (e) { throw e }
}

//cambiar datos usuario
async function cambiarContraseñaUsuario(contraseña) {//48h para volver a cambiarla
    const correo = getCorreoSesion()
    const fecha_bloqueo = new Date(Date.now() + (48 * 60 * 20 * 1000))
    try {
        const r = await User.updateOne(
            { correo: correo },//filtro
            {
                $set: {
                    contrasena: contraseña,
                    exp_bloq_contrasena: fecha_bloqueo
                }
            },
            { upsert: false }
        )
        if (r.matchedCount === 0) return false; // correo no encontrado

        setFechaBloqueoContraseña(fecha_bloqueo)
        return true
    } catch (e) {
        console.error(e)
        return null
    }
}
async function cambiarCorreoUsuario(correo) {//14dias para volver a cambiarlo
    const correo_viejo = getCorreoSesion()
    const fecha_bloqueo = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    //actualizar todas las tablas importantes
    try {
        const r = await User.updateOne(
            { correo: correo_viejo },              // filtro
            {
                $set: {
                    correo: correo,
                    exp_bloq_correo: fecha_bloqueo // corrección a ms
                }
            },
            { upsert: false }
        );
        if (r.matchedCount === 0) return false; // correo no encontrado

        //limpiar datos relacionados con codigos y tokens
        await BorrarUsuarioActivo()
        //actualizar
        setCorreoSesion(correo)
        setFechaBloqueoCorreo(fecha_bloqueo)

            //limpiar (asincronos)
            (async () => {
                try { BorrarCuentaVC(correo_viejo) } catch (e) { console.error(e) }
                try { ActualizarUsuarioActivo(correo_viejo) } catch (e) { console.error(e) }
                try { LimpiarJWTUsuarioVC(correo_viejo) } catch (e) { console.error(e) }
                try { LimpiarJWTUsuario(correo_viejo) } catch (e) { console.error(e) }
            })()

        return true
    } catch (e) {
        console.error(e)
        return null
    }

}
async function cambiarApodoUsuario(apodo) {//24h para vovler a cambiarlo
    const correo = getCorreoSesion()
    const fecha_bloqueo = new Date(Date.now() + (24 * 60 * 20 * 1000))
    try {
        const r = await User.updateOne(
            { correo: correo },//filtro
            {
                $set: {
                    apodo: apodo,
                    exp_bloq_apodo: fecha_bloqueo
                }
            },
            { upsert: false }
        );
        if (r.matchedCount === 0) return false; // correo no encontrado

        setApodoSesion(apodo)
        setFechaBloqueoApodo(fecha_bloqueo)
        return true
    }
    catch (e) {
        console.log(e)
        return null
    }
}
async function ActualizarSecretKeyUsuario(actualizar = true) {
    const key = crypto.randomBytes(32).toString("hex");
    if (!actualizar) return key;//solo genera la key pero no la guarda directamente
    try {
        const correo = getCorreoSesion()
        const r = await User.updateOne(
            { correo },//filtro
            {
                $set: {
                    secretKey: key,
                }
            },
            { upsert: false }
        );
        if (r.matchedCount === 0) return false; // correo no encontrado

        return key
    }
    catch (e) {
        console.error(e)

        return null
    }
}
//chats
async function limpiar_mensajes_chats_antiguos(data) {
    const chatIds = data.map(c => c.id);
    if (chatIds.length == 0) return null;
    //borrar chats de hace mas de un año 
    const haceUnAno = new Date();
    haceUnAno.setFullYear(haceUnAno.getFullYear() - 1);
    try {//como es asincrono siempre y no tiene nada que ocurra posterior no romperia si falla
        const r = await ChatsRavage.updateMany(
            { _id: { $in: chatIds } }, // solo esos chats del usuario
            {
                $pull: {
                    mensajes: { data: { $lt: haceUnAno } } // elimina mensajes antiguos
                }
            }
        );
        if (r.matchedCount === 0) return false; // correo no encontrado
        return true
    } catch (e) {
        console.error(e)
        return null;
    }
}
async function obtener_datos_chats({ data = [], grupales = null, mensajes = true }) {
    try {
        //sacar los ids
        const chatIds = data
            .filter(c => grupales === null || c.grupo === grupales)
            .map(c => c.id);

        //si no hay ids ->terminar
        if (chatIds.length === 0) return []

        //buscar los datos por mongodb
        let data_obtenida = await ChatsRavage.find(
            { _id: { $in: chatIds } },//filtro(todos los chatsid)
            { _id: 1, mensajes: mensajes ? 1 : 0 }  // 0 = excluir
        );
        //pasar _id a string
        return data_obtenida.map(el => ({
            ...el.toObject?.() ?? el,
            _id: el._id.toString(),
            usuarios: el.usuarios.map(c => c.toString())
        }));
    } catch (e) {
        console.error(e)
        return []
    }
}
//funcion muy parecida a la de obtener varios chats ,pero optimizada y funciona distinto
async function obtener_datos_chat_unico(id) {
    try {
        //buscar los datos por mongodb
        let data_obtenida = await ChatsRavage.findById(id);
        if (!data_obtenida) return null;//chat no encontrado
        const obj = data_obtenida.toObject?.() ?? data_obtenida;//si existe object() lo llama, sino data_obtenida ya es object

        return {
            ...obj,
            _id: obj._id.toString(),
            usuarios: obj.usuarios.map(u => u.toString())
        };
    } catch (e) {
        console.error(e)
        return null
    }
}
async function CREAR_CHAT_NUEVO(ids = null, nombre = "") {//tu no vas dentro de esos ids, debes añadirlo
    if (!ids || ids.length === 0) return null;

    const id_propio = getIDMongodbUsuario();
    const grupo = ids.length !== 1;
    const ids_añadir = [...ids, id_propio];

    let datos_chat;

    try {
        // crear chat
        datos_chat = await ChatsRavage.create({
            nombre: grupo ? nombre : "",
            usuarios: ids_añadir,
            grupo
        });

        // actualizar chats de todos los integrantes
        await User.updateMany(
            { _id: { $in: ids_añadir } },
            {
                $addToSet: {
                    chats: {
                        id: datos_chat._id,
                        nombre: datos_chat.nombre,
                        grupo: datos_chat.grupo,
                        ultimoCambio: new Date(),
                        ultimomensaje: "Bienvenido😀"
                    }
                }
            }
        );

        // si es chat 1-a-1, añadir contacto
        if (ids.length === 1) {
            await AÑADIR_CONTACTO(ids[0], nombre);
        }

        return datos_chat; // devolver chat creado

    } catch (e) {
        // rollback: borrar chat si se creó
        if (datos_chat?._id) {
            await ChatsRavage.deleteOne({ _id: datos_chat._id });
        }
        throw e
    }
}
//contactos / usuarios externos
async function obtener_datos_usuario(id, datos_usar = null) {
    const datos_buscar_defecto = "correo apodo visible idamigo"//se separan por espacio
    const datos_buscar = datos_usar ? datos_usar : datos_buscar_defecto //elegir datos buscar

    const usuario = await User.findById(id, datos_buscar).lean();
    if (!usuario) return null;

    return {
        ...usuario,
        _id: usuario._id?.toString(),
    };
}
async function encontrar_usuario(texto, correo = false) {
    //TODO: DEBE REVISAR SI EN MONGODB ESA CUENTA ESTA BLOQUEADA DE LA APP (bloqueo global)
    // función que revisa bloqueos
    const bloqueado = (usuario) => {
        const id_buscado = usuario._id.toString();
        const id_propio = getIDMongodbUsuario();

        // si te tiene bloqueado o tú lo tienes bloqueado
        const verificaciones = [
            usuario.users_bloq.includes(id_propio),// te tiene bloqueado
            getUsuariosBloqueados().includes(id_buscado) // tú lo tienes bloqueado
        ]
        return verificaciones.some(Boolean);//comprobar si se cumple alguna
    }
    try {
        // filtro dinámico
        const filtro = correo
            ? { correo: texto, mostrarCorreo: true, visible: true, bloquearChatsNuevos: false }
            : { idamigo: texto, visible: true, bloquearChatsNuevos: false };

        // campos a traer
        const campos = "_id apodo users_bloq";

        const usuario = await User.findOne(filtro, campos).lean();
        if (!usuario || bloqueado(usuario)) return null;

        return { id: usuario._id.toString(), nombre: usuario.apodo };

    } catch (e) {
        console.error(e);
        return null;
    }
}
async function AÑADIR_CONTACTO(id, nombre) {
    try {
        const id_propio = getIDMongodbUsuario();
        const r = await User.updateOne(
            { _id: id_propio, "contactos.id": { $ne: id } }, // añade solo si ese id no existe
            {
                $push: { contactos: { id, apodo: nombre } }
            }
        );
        return r.modifiedCount > 0; // true si se añadió, false si ya existía
    } catch (e) {
        console.error(e);
        return false;
    }
}
module.exports = { connectDB, closeDB, InsertarUsuario, LoginUsuarioDB, LimpiarJWTUsuario, InsertarVC, BorrarVC, User, ValidationCode, CuentaValidationCode, InsertarCuentaVC, BorrarCuentaVC, BorrarUsuarioActivo, LimpiarJWTUsuario, AñadirJWTUsuario, AñadirJWTUsuarioVC, LimpiarJWTUsuarioVC, TokenSession, TokenVC, ActualizarUsuarioActivo, cambiarContraseñaUsuario, cambiarCorreoUsuario, cambiarApodoUsuario, DatosCuentaVC, InsertarDatosCuentaVC, BorrarDatosCuentaVC, eliminarUsuariosBloqueados, eliminarUsuariosSilenciados, añadirUsuariosBloqueados, añadirUsuariosSilenciados, TokenDPC, DispositivosBloqueados, ActualizarSecretKeyUsuario, obtener_datos_chats, obtener_datos_chat_unico, limpiar_mensajes_chats_antiguos, encontrar_usuario, CREAR_CHAT_NUEVO, obtener_datos_usuario }