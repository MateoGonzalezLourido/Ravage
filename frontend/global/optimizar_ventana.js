export function optimizar_ventana() {
    // Pausar animaciones cuando la ventana pierde visibilidad (minimizar, cambiar ventana, etc.)
    document.addEventListener('visibilitychange', () => {
        document.body.style.setProperty('--animate',
            document.hidden ? 'paused' : 'running'
        );
    });
}