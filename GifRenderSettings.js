
console.log('Loading GifRenderSettings component...');

const GifRenderSettings = ({ 
    isVisible, 
    onClose, 
    onRender, 
    renderArea 
}) => {
    const [settings, setSettings] = React.useState({
        quality: 10,           // Качество квантизации (1-30, меньше = лучше)
        workers: 2,            // Количество воркеров
        width: 400,            // Ширина
        height: 300,           // Высота
        frameRate: 30,         // FPS
        duration: 2,           // Длительность в секундах
        delay: 33,             // Задержка между кадрами (мс)
        repeat: 0,             // Количество повторов (0 = бесконечно)
        dither: false,         // Дизеринг
        transparent: null,     // Прозрачный цвет
        background: '#ffffff', // Фон
        optimizeTransparency: false, // Оптимизация прозрачности
        debug: false,          // Отладочная информация
        copy: true             // Копировать кадры
    });

    const [isRendering, setIsRendering] = React.useState(false);
    const [progress, setProgress] = React.useState(0);

    // Обновляем размеры при изменении области рендера
    React.useEffect(() => {
        if (renderArea) {
            setSettings(prev => ({
                ...prev,
                width: Math.round(renderArea.width),
                height: Math.round(renderArea.height)
            }));
        }
    }, [renderArea]);

    // Автоматический расчет delay на основе frameRate
    React.useEffect(() => {
        const calculatedDelay = Math.round(1000 / settings.frameRate);
        if (calculatedDelay !== settings.delay) {
            setSettings(prev => ({
                ...prev,
                delay: calculatedDelay
            }));
        }
    }, [settings.frameRate]);

    const handleSettingChange = (key, value) => {
        setSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleRender = async () => {
        setIsRendering(true);
        setProgress(0);

        try {
            await onRender(settings, (progressValue) => {
                setProgress(progressValue);
            });
        } catch (error) {
            console.error('Error rendering GIF:', error);
            alert('Error rendering GIF: ' + error.message);
        } finally {
            setIsRendering(false);
            setProgress(0);
        }
    };

    const getEstimatedFileSize = () => {
        const { width, height, frameRate, duration, quality } = settings;
        const totalFrames = frameRate * duration;
        const pixelsPerFrame = width * height;
        const totalPixels = pixelsPerFrame * totalFrames;

        // Приблизительная оценка размера файла
        const baseSize = totalPixels * 0.5; // Базовый размер
        const qualityFactor = (31 - quality) / 30; // Фактор качества
        const estimatedSize = baseSize * qualityFactor;

        if (estimatedSize > 1024 * 1024) {
            return `${(estimatedSize / (1024 * 1024)).toFixed(1)} MB`;
        } else if (estimatedSize > 1024) {
            return `${(estimatedSize / 1024).toFixed(1)} KB`;
        } else {
            return `${estimatedSize.toFixed(0)} B`;
        }
    };

    if (!isVisible) return null;

    // Проверяем темную тему
    const isDarkTheme = document.body.classList.contains('dark-theme');

    return (
        <div style={{
            position: 'fixed',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: isDarkTheme ? 'rgba(0, 0, 0, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '15px',
            padding: '8px 16px',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            border: `1px solid ${isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            fontSize: '11px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: isDarkTheme ? '#e0e0e0' : '#333',
            minWidth: '800px'
        }}>
            {/* Качество */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '120px' }}>
                <span style={{ fontSize: '10px', fontWeight: '600' }}>
                    Качество {settings.quality}
                </span>
                <input
                    type="range"
                    min="1"
                    max="30"
                    value={settings.quality}
                    onChange={(e) => handleSettingChange('quality', parseInt(e.target.value))}
                    style={{
                        width: '60px',
                        height: '3px',
                        borderRadius: '2px',
                        background: isDarkTheme ? '#333' : '#ddd',
                        outline: 'none',
                        appearance: 'none'
                    }}
                />
            </div>

            {/* FPS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '100px' }}>
                <span style={{ fontSize: '10px', fontWeight: '600' }}>
                    FPS {settings.frameRate}
                </span>
                <input
                    type="range"
                    min="10"
                    max="60"
                    value={settings.frameRate}
                    onChange={(e) => handleSettingChange('frameRate', parseInt(e.target.value))}
                    style={{
                        width: '60px',
                        height: '3px',
                        borderRadius: '2px',
                        background: isDarkTheme ? '#333' : '#ddd',
                        outline: 'none',
                        appearance: 'none'
                    }}
                />
            </div>

            {/* Длительность */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '120px' }}>
                <span style={{ fontSize: '10px', fontWeight: '600' }}>
                    Длительность {settings.duration}s
                </span>
                <input
                    type="range"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={settings.duration}
                    onChange={(e) => handleSettingChange('duration', parseFloat(e.target.value))}
                    style={{
                        width: '60px',
                        height: '3px',
                        borderRadius: '2px',
                        background: isDarkTheme ? '#333' : '#ddd',
                        outline: 'none',
                        appearance: 'none'
                    }}
                />
            </div>

            {/* Кадры */}
            <div style={{ 
                fontSize: '10px', 
                fontWeight: '600',
                color: isDarkTheme ? '#888' : '#666',
                minWidth: '60px',
                textAlign: 'center'
            }}>
                Кадры: {settings.frameRate * settings.duration}
            </div>

            {/* Задержка */}
            <div style={{ 
                fontSize: '10px', 
                fontWeight: '600',
                color: isDarkTheme ? '#888' : '#666',
                minWidth: '80px',
                textAlign: 'center'
            }}>
                Задержка: {settings.delay}ms
            </div>

            {/* Размер */}
            <div style={{ 
                fontSize: '10px', 
                fontWeight: '600',
                color: isDarkTheme ? '#888' : '#666',
                minWidth: '80px',
                textAlign: 'center'
            }}>
                Размер: ~{getEstimatedFileSize()}
            </div>

            {/* Прогресс */}
            {isRendering && (
                <div style={{
                    minWidth: '80px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    <div style={{
                        width: '50px',
                        height: '4px',
                        background: isDarkTheme ? '#333' : '#f0f0f0',
                        borderRadius: '2px',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            width: `${progress}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #4caf50, #81c784)',
                            transition: 'width 0.3s ease',
                            borderRadius: '2px'
                        }} />
                    </div>
                    <span style={{ fontSize: '9px', minWidth: '25px' }}>
                        {Math.round(progress)}%
                    </span>
                </div>
            )}

            {/* Кнопка создания */}
            <button
                onClick={handleRender}
                disabled={isRendering}
                style={{
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    background: isRendering ? 
                        (isDarkTheme ? '#333' : '#ccc') : 
                        'linear-gradient(90deg, #4caf50, #81c784)',
                    color: 'white',
                    cursor: isRendering ? 'not-allowed' : 'pointer',
                    fontSize: '11px',
                    fontWeight: '600',
                    minWidth: '80px',
                    transition: 'all 0.2s ease',
                    height: '28px'
                }}
                onMouseEnter={(e) => {
                    if (!isRendering) {
                        e.target.style.transform = 'scale(1.05)';
                    }
                }}
                onMouseLeave={(e) => {
                    e.target.style.transform = 'scale(1)';
                }}
            >
                {isRendering ? 'Создание...' : 'Создать GIF'}
            </button>

            {/* Кнопка закрытия */}
            <button 
                onClick={onClose}
                disabled={isRendering}
                style={{
                    width: '20px',
                    height: '20px',
                    border: 'none',
                    borderRadius: '50%',
                    background: isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDarkTheme ? '#888' : '#666',
                    cursor: isRendering ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isRendering ? 0.5 : 1,
                    transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                    if (!isRendering) {
                        e.target.style.background = isDarkTheme ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
                    }
                }}
                onMouseLeave={(e) => {
                    e.target.style.background = isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
                }}
            >
                ×
            </button>
        </div>
    );
};

if (typeof window !== 'undefined') {
    window.GifRenderSettings = GifRenderSettings;
} else if (typeof global !== 'undefined') {
    global.GifRenderSettings = GifRenderSettings;
} else if (typeof globalThis !== 'undefined') {
    globalThis.GifRenderSettings = GifRenderSettings;
} else {
    console.error('Unable to find global object to attach GifRenderSettings');
}

console.log('GifRenderSettings.js has finished loading');
