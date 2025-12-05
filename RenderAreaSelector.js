console.log('Loading RenderAreaSelector component...');

const RenderAreaSelector = ({ canvas, isVisible, onClose, onRender, format, onFormatChange }) => {
    const [renderArea, setRenderArea] = React.useState({
        x: 100,
        y: 100,
        width: 400,
        height: 400
    });
    const [isDragging, setIsDragging] = React.useState(false);
    const [dragStart, setDragStart] = React.useState(null);
    const [resizeHandle, setResizeHandle] = React.useState(null);
    const overlayRef = React.useRef(null);
    const [settings, setSettings] = React.useState({
        quality: 10,
        workers: 2,
        frameRate: 30,
        duration: 2,
        delay: 33,
        repeat: 0,
        dither: false,
        background: 'transparent',
        optimizeTransparency: false,
        debug: false,
        copy: true
    });

    const [isRendering, setIsRendering] = React.useState(false);
    const [progress, setProgress] = React.useState(0);

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

    const handleGifRender = async () => {
        setIsRendering(true);
        setProgress(0);

        try {
            const finalSettings = {
                ...settings,
                width: Math.round(renderArea.width),
                height: Math.round(renderArea.height)
            };

            const screenArea = {
                x: renderArea.x,
                y: renderArea.y,
                width: renderArea.width,
                height: renderArea.height
            };

            await onRender(screenArea, format, finalSettings, (progressValue) => {
                setProgress(progressValue);
            });

            onClose();

        } catch (error) {
            console.error('Error rendering GIF:', error);
            alert('Error rendering GIF: ' + error.message);
        } finally {
            setIsRendering(false);
            setProgress(0);
        }
    };

    const getEstimatedFileSize = () => {
        const { frameRate, duration, quality } = settings;
        const totalFrames = frameRate * duration;
        const pixelsPerFrame = renderArea.width * renderArea.height;
        const totalPixels = pixelsPerFrame * totalFrames;

        const baseSize = totalPixels * 0.5;
        const qualityFactor = (31 - quality) / 30;
        const estimatedSize = baseSize * qualityFactor;

        if (estimatedSize > 1024 * 1024) {
            return `~${(estimatedSize / (1024 * 1024)).toFixed(1)} MB`;
        } else if (estimatedSize > 1024) {
            return `~${(estimatedSize / 1024).toFixed(1)} KB`;
        } else {
            return `~${estimatedSize.toFixed(0)} B`;
        }
    };

    const presets = {
        square: { width: 400, height: 400, name: "1:1" },
        portrait: { width: 300, height: 400, name: "3:4" },
        landscape: { width: 500, height: 300, name: "5:3" },
        story: { width: 240, height: 426, name: "9:16" }
    };

    React.useEffect(() => {
        if (isVisible && canvas) {
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            const centerX = viewportWidth / 2 - renderArea.width / 2;
            const centerY = viewportHeight / 2 - renderArea.height / 2;

            setRenderArea(prev => ({
                ...prev,
                x: Math.max(0, centerX),
                y: Math.max(0, centerY)
            }));
        }
    }, [isVisible, canvas]);

    const handleMouseDown = (e) => {
        if (!isVisible) return;

        const rect = overlayRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const handle = getResizeHandle(x, y);

        if (handle) {
            setResizeHandle(handle);
            setIsDragging(true);
            setDragStart({ x, y });
        } else if (isInsideArea(x, y)) {
            setResizeHandle('move');
            setIsDragging(true);
            setDragStart({ x: x - renderArea.x, y: y - renderArea.y });
        }
    };

    const handleTouchStart = (e) => {
        if (!isVisible || e.touches.length !== 1) return;
        
        e.preventDefault();
        const touch = e.touches[0];
        const rect = overlayRef.current.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        const handle = getResizeHandle(x, y);

        if (handle) {
            setResizeHandle(handle);
            setIsDragging(true);
            setDragStart({ x, y });
        } else if (isInsideArea(x, y)) {
            setResizeHandle('move');
            setIsDragging(true);
            setDragStart({ x: x - renderArea.x, y: y - renderArea.y });
        }
    };

    const handleTouchMove = (e) => {
        if (!isDragging || !dragStart || e.touches.length !== 1) return;
        
        e.preventDefault();
        const touch = e.touches[0];
        const rect = overlayRef.current.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        if (resizeHandle === 'move') {
            const newX = Math.max(0, Math.min(rect.width - renderArea.width, x - dragStart.x));
            const newY = Math.max(0, Math.min(rect.height - renderArea.height, y - dragStart.y));

            setRenderArea(prev => ({
                ...prev,
                x: newX,
                y: newY
            }));
        } else {
            const deltaX = x - dragStart.x;
            const deltaY = y - dragStart.y;

            setRenderArea(prev => {
                let newArea = { ...prev };

                switch (resizeHandle) {
                    case 'nw':
                        newArea.x = Math.max(0, prev.x + deltaX);
                        newArea.y = Math.max(0, prev.y + deltaY);
                        newArea.width = Math.max(50, prev.width - deltaX);
                        newArea.height = Math.max(50, prev.height - deltaY);
                        break;
                    case 'ne':
                        newArea.y = Math.max(0, prev.y + deltaY);
                        newArea.width = Math.max(50, prev.width + deltaX);
                        newArea.height = Math.max(50, prev.height - deltaY);
                        break;
                    case 'sw':
                        newArea.x = Math.max(0, prev.x + deltaX);
                        newArea.width = Math.max(50, prev.width - deltaX);
                        newArea.height = Math.max(50, prev.height + deltaY);
                        break;
                    case 'se':
                        newArea.width = Math.max(50, prev.width + deltaX);
                        newArea.height = Math.max(50, prev.height + deltaY);
                        break;
                    case 'n':
                        newArea.y = Math.max(0, prev.y + deltaY);
                        newArea.height = Math.max(50, prev.height - deltaY);
                        break;
                    case 's':
                        newArea.height = Math.max(50, prev.height + deltaY);
                        break;
                    case 'w':
                        newArea.x = Math.max(0, prev.x + deltaX);
                        newArea.width = Math.max(50, prev.width - deltaX);
                        break;
                    case 'e':
                        newArea.width = Math.max(50, prev.width + deltaX);
                        break;
                }

                if (newArea.x + newArea.width > rect.width) {
                    newArea.width = rect.width - newArea.x;
                }
                if (newArea.y + newArea.height > rect.height) {
                    newArea.height = rect.height - newArea.y;
                }

                return newArea;
            });

            setDragStart({ x, y });
        }
    };

    const handleTouchEnd = (e) => {
        if (e.touches.length === 0) {
            setIsDragging(false);
            setDragStart(null);
            setResizeHandle(null);
        }
    };

    const handleMouseMove = (e) => {
        if (!isDragging || !dragStart) return;

        const rect = overlayRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (resizeHandle === 'move') {

            const newX = Math.max(0, Math.min(rect.width - renderArea.width, x - dragStart.x));
            const newY = Math.max(0, Math.min(rect.height - renderArea.height, y - dragStart.y));

            setRenderArea(prev => ({
                ...prev,
                x: newX,
                y: newY
            }));
        } else {

            const deltaX = x - dragStart.x;
            const deltaY = y - dragStart.y;

            setRenderArea(prev => {
                let newArea = { ...prev };

                switch (resizeHandle) {
                    case 'nw':
                        newArea.x = Math.max(0, prev.x + deltaX);
                        newArea.y = Math.max(0, prev.y + deltaY);
                        newArea.width = Math.max(50, prev.width - deltaX);
                        newArea.height = Math.max(50, prev.height - deltaY);
                        break;
                    case 'ne':
                        newArea.y = Math.max(0, prev.y + deltaY);
                        newArea.width = Math.max(50, prev.width + deltaX);
                        newArea.height = Math.max(50, prev.height - deltaY);
                        break;
                    case 'sw':
                        newArea.x = Math.max(0, prev.x + deltaX);
                        newArea.width = Math.max(50, prev.width - deltaX);
                        newArea.height = Math.max(50, prev.height + deltaY);
                        break;
                    case 'se':
                        newArea.width = Math.max(50, prev.width + deltaX);
                        newArea.height = Math.max(50, prev.height + deltaY);
                        break;
                    case 'n':
                        newArea.y = Math.max(0, prev.y + deltaY);
                        newArea.height = Math.max(50, prev.height - deltaY);
                        break;
                    case 's':
                        newArea.height = Math.max(50, prev.height + deltaY);
                        break;
                    case 'w':
                        newArea.x = Math.max(0, prev.x + deltaX);
                        newArea.width = Math.max(50, prev.width - deltaX);
                        break;
                    case 'e':
                        newArea.width = Math.max(50, prev.width + deltaX);
                        break;
                }


                if (newArea.x + newArea.width > rect.width) {
                    newArea.width = rect.width - newArea.x;
                }
                if (newArea.y + newArea.height > rect.height) {
                    newArea.height = rect.height - newArea.y;
                }

                return newArea;
            });

            setDragStart({ x, y });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDragStart(null);
        setResizeHandle(null);
    };

    const getResizeHandle = (x, y) => {
        const { x: rx, y: ry, width, height } = renderArea;
        const handleSize = 15;

        if (Math.abs(x - rx) < handleSize && Math.abs(y - ry) < handleSize) return 'nw';
        if (Math.abs(x - (rx + width)) < handleSize && Math.abs(y - ry) < handleSize) return 'ne';
        if (Math.abs(x - rx) < handleSize && Math.abs(y - (ry + height)) < handleSize) return 'sw';
        if (Math.abs(x - (rx + width)) < handleSize && Math.abs(y - (ry + height)) < handleSize) return 'se';

        if (Math.abs(y - ry) < handleSize && x > rx && x < rx + width) return 'n';
        if (Math.abs(y - (ry + height)) < handleSize && x > rx && x < rx + width) return 's';
        if (Math.abs(x - rx) < handleSize && y > ry && y < ry + height) return 'w';
        if (Math.abs(x - (rx + width)) < handleSize && y > ry && y < ry + height) return 'e';

        return null;
    };

    const isInsideArea = (x, y) => {
        return x >= renderArea.x && x <= renderArea.x + renderArea.width &&
               y >= renderArea.y && y <= renderArea.y + renderArea.height;
    };

    const applyPreset = (presetKey) => {
        const preset = presets[presetKey];
        const rect = overlayRef.current.getBoundingClientRect();

        setRenderArea(prev => ({
            x: Math.max(0, Math.min(rect.width - preset.width, prev.x)),
            y: Math.max(0, Math.min(rect.height - preset.height, prev.y)),
            width: preset.width,
            height: preset.height
        }));
    };

    const handleRender = (gifSettings = null) => {
        if (!canvas) return;

        const screenArea = {
            x: renderArea.x,
            y: renderArea.y,
            width: renderArea.width,
            height: renderArea.height
        };

        if (format === 'gif' && gifSettings) {

            onRender(screenArea, format, gifSettings);
        } else {

            onRender(screenArea, format);
        }

        if (format !== 'gif') {
            onClose();
        }
    };

    React.useEffect(() => {
        if (isVisible) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
            };
        }
    }, [isVisible, isDragging, dragStart, resizeHandle]);

    if (!isVisible) return null;

    const isDarkTheme = document.body.classList.contains('dark-theme');

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none'
        }}>
            {/* Панель управления */}
            <div style={{
                position: 'absolute',
                top: window.innerWidth <= 768 ? '10px' : '18px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: isDarkTheme ? 'transparent' : 'transparent',
                backdropFilter: 'blur(10px)',
                border: `transparent`,
                padding: window.innerWidth <= 768 ? '6px 12px' : '8px 20px',
                borderRadius: '16px',
                boxShadow: isDarkTheme ? 
                    'transparent' : 
                    'transparent',
                zIndex: 2001,
                maxWidth: window.innerWidth <= 768 ? '95vw' : '90vw',
                maxHeight: window.innerWidth <= 768 ? '90vh' : '80vh',
                overflow: 'auto'
            }}>
                {/* Панель управления адаптивная для мобилки */}
                <div style={{ 
                    display: 'flex', 
                    gap: window.innerWidth <= 768 ? '8px' : '12px', 
                    alignItems: 'center',
                    flexWrap: window.innerWidth <= 768 ? 'wrap' : 'nowrap',
                    fontSize: window.innerWidth <= 768 ? '10px' : '11px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    justifyContent: window.innerWidth <= 768 ? 'center' : 'flex-start'
                }}>


                    <div style={{ 
                        display: 'flex', 
                        gap: window.innerWidth <= 768 ? '4px' : '6px',
                        background: isDarkTheme ? 'transparent' : 'transparent',
                        padding: window.innerWidth <= 768 ? '2px' : '4px',
                        borderRadius: '8px',
                        flexWrap: window.innerWidth <= 768 ? 'wrap' : 'nowrap',
                        justifyContent: 'center'
                    }}>
                        {Object.entries(presets).map(([key, preset]) => (
                            <button
                                key={key}
                                onClick={() => applyPreset(key)}
                                style={{
                                    padding: window.innerWidth <= 768 ? '4px 8px' : '6px 10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: isDarkTheme ? '#a0a0a0' : '#666666',
                                    cursor: 'pointer',
                                    fontSize: window.innerWidth <= 768 ? '9px' : '11px',
                                    fontWeight: '500',
                                    transition: 'all 0.2s ease',
                                    minWidth: window.innerWidth <= 768 ? '28px' : '35px',
                                    height: window.innerWidth <= 768 ? '28px' : 'auto'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.background = isDarkTheme ? 'transparent' : 'transparent';
                                    e.target.style.color = isDarkTheme ? '#ffffff' : '#000000';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.background = 'transparent';
                                    e.target.style.color = isDarkTheme ? '#a0a0a0' : '#666666';
                                }}
                            >
                                {preset.name}
                            </button>
                        ))}
                    </div>

                    {/* Выбор формата */}
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: window.innerWidth <= 768 ? '2px' : '4px', 
                        minWidth: window.innerWidth <= 768 ? '80px' : '120px',
                        order: window.innerWidth <= 768 ? 1 : 0
                    }}>
                        <span style={{ 
                            fontSize: window.innerWidth <= 768 ? '9px' : '10px', 
                            fontWeight: '600' 
                        }}>
                            {window.innerWidth <= 768 ? 'Fmt:' : 'Формат:'}
                        </span>
                        <select
                            value={format}
                            onChange={(e) => {
                                const newFormat = e.target.value;
                                if (typeof onFormatChange === 'function') {
                                    onFormatChange(newFormat);
                                }
                            }}
                            style={{
                                fontSize: window.innerWidth <= 768 ? '9px' : '10px',
                                padding: window.innerWidth <= 768 ? '1px 2px' : '2px 4px',
                                borderRadius: '3px',
                                border: `1px solid ${isDarkTheme ? '#333' : '#ddd'}`,
                                background: isDarkTheme ? '#333' : '#fff',
                                color: isDarkTheme ? '#e0e0e0' : '#333',
                                minWidth: window.innerWidth <= 768 ? '50px' : '60px'
                            }}
                        >
                            <option value="png">PNG</option>
                            <option value="gif">GIF</option>
                            <option value="apng">APNG</option>
                        </select>
                    </div>

                    {/* Размер области */}
                    <div style={{ 
                        fontSize: window.innerWidth <= 768 ? '9px' : '10px', 
                        fontWeight: '600',
                        color: isDarkTheme ? '#888' : '#666',
                        minWidth: window.innerWidth <= 768 ? '60px' : '100px',
                        textAlign: 'center',
                        order: window.innerWidth <= 768 ? 2 : 0
                    }}>
                        {renderArea.width.toFixed(0)} × {renderArea.height.toFixed(0)}
                    </div>

                    {/* GIF настройки - адаптивные для мобилки */}
                    {format === 'gif' && (
                        <>
                            {/* Качество */}
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: window.innerWidth <= 768 ? '3px' : '6px', 
                                minWidth: window.innerWidth <= 768 ? '70px' : '100px',
                                order: window.innerWidth <= 768 ? 3 : 0
                            }}>
                                <span style={{ 
                                    fontSize: window.innerWidth <= 768 ? '8px' : '10px', 
                                    fontWeight: '600' 
                                }}>
                                    {window.innerWidth <= 768 ? `C${settings.quality}` : `COMP ${settings.quality}`}
                                </span>
                                <input
                                    type="range"
                                    min="1"
                                    max="30"
                                    value={settings.quality}
                                    onChange={(e) => handleSettingChange('quality', parseInt(e.target.value))}
                                    style={{
                                        width: window.innerWidth <= 768 ? '40px' : '60px',
                                        height: '3px',
                                        background: isDarkTheme ? '#333' : '#ddd',
                                        outline: 'none',
                                        appearance: 'none'
                                    }}
                                />
                            </div>

                            {/* FPS */}
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: window.innerWidth <= 768 ? '3px' : '6px', 
                                minWidth: window.innerWidth <= 768 ? '60px' : '80px',
                                order: window.innerWidth <= 768 ? 4 : 0
                            }}>
                                <span style={{ 
                                    fontSize: window.innerWidth <= 768 ? '8px' : '10px', 
                                    fontWeight: '600' 
                                }}>
                                    {window.innerWidth <= 768 ? `F${settings.frameRate}` : `FPS ${settings.frameRate}`}
                                </span>
                                <input
                                    type="range"
                                    min="10"
                                    max="60"
                                    value={settings.frameRate}
                                    onChange={(e) => handleSettingChange('frameRate', parseInt(e.target.value))}
                                    style={{
                                        width: window.innerWidth <= 768 ? '40px' : '60px',
                                        height: '3px',
                                        borderRadius: 'transparent',
                                        background: isDarkTheme ? '#333' : '#ddd',
                                        outline: 'none',
                                        appearance: 'none'
                                    }}
                                />
                            </div>

                            {/* Длительность */}
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: window.innerWidth <= 768 ? '3px' : '6px', 
                                minWidth: window.innerWidth <= 768 ? '70px' : '100px',
                                order: window.innerWidth <= 768 ? 5 : 0
                            }}>
                                <span style={{ 
                                    fontSize: window.innerWidth <= 768 ? '8px' : '10px', 
                                    fontWeight: '600' 
                                }}>
                                    {window.innerWidth <= 768 ? `T${settings.duration}s` : `TIME ${settings.duration}s`}
                                </span>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="10"
                                    step="0.5"
                                    value={settings.duration}
                                    onChange={(e) => handleSettingChange('duration', parseFloat(e.target.value))}
                                    style={{
                                        width: window.innerWidth <= 768 ? '40px' : '60px',
                                        height: '3px',
                                        borderRadius: 'transparent',
                                        background: isDarkTheme ? '#333' : '#ddd',
                                        outline: 'none',
                                        appearance: 'none'
                                    }}
                                />
                            </div>

                            {/* Прогресс бар */}
                            {isRendering && (
                                <div style={{
                                    minWidth: window.innerWidth <= 768 ? '50px' : '70px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: window.innerWidth <= 768 ? '3px' : '6px',
                                    order: window.innerWidth <= 768 ? 6 : 0
                                }}>
                                    <div style={{
                                        width: window.innerWidth <= 768 ? '30px' : '40px',
                                        height: '3px',
                                        background: isDarkTheme ? 'transparent' : 'transparent',
                                        borderRadius: 'transparent',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            width: `${progress}%`,
                                            height: '100%',
                                            background: 'transparent',
                                            transition: 'width 0.3s ease',
                                            borderRadius: 'transparent'
                                        }} />
                                    </div>
                                    <span style={{ 
                                        fontSize: window.innerWidth <= 768 ? '8px' : '9px', 
                                        minWidth: window.innerWidth <= 768 ? '15px' : '20px' 
                                    }}>
                                        {Math.round(progress)}%
                                    </span>
                                </div>
                            )}

                            {/* Кнопка создания GIF */}
                            <button
                                onClick={handleGifRender}
                                disabled={isRendering}
                                style={{
                                    padding: window.innerWidth <= 768 ? '4px 8px' : '6px 12px',
                                    border: 'none',
                                    borderRadius: '6px',
                                    background: isRendering ? 
                                        (isDarkTheme ? 'transparent' : 'transparent') : 
                                        'transparent',
                                    color: isDarkTheme ? '#ffffff' : '#000000',
                                    cursor: isRendering ? 'not-allowed' : 'pointer',
                                    fontSize: window.innerWidth <= 768 ? '10px' : '12px',
                                    fontWeight: '600',
                                    minWidth: window.innerWidth <= 768 ? '60px' : '80px',
                                    transition: 'all 0.2s ease',
                                    height: window.innerWidth <= 768 ? '26px' : '28px',
                                    order: window.innerWidth <= 768 ? 7 : 0
                                }}
                                onMouseEnter={(e) => {
                                    if (!isRendering) {
                                        e.target.style.transform = window.innerWidth <= 768 ? 'scale(1.1)' : 'scale(1.6)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.transform = 'scale(1)';
                                }}
                            >
                                {isRendering ? 
                                    (window.innerWidth <= 768 ? 'REND...' : 'RENDERING...') : 
                                    (window.innerWidth <= 768 ? 'GIF' : 'GO GIF')
                                }
                            </button>
                        </>
                    )}

                    {/* Кнопка рендеринга для PNG */}
                    {format === 'png' && (
                        <button
                            onClick={handleRender}
                            style={{
                                padding: window.innerWidth <= 768 ? '4px 8px' : '6px 12px',
                                background: 'transparent',
                                color: isDarkTheme ? '#ffffff' : '#000000',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: window.innerWidth <= 768 ? '10px' : '12px',
                                transition: 'all 0.2s ease',
                                minWidth: window.innerWidth <= 768 ? '60px' : 'auto',
                                height: window.innerWidth <= 768 ? '26px' : 'auto',
                                order: window.innerWidth <= 768 ? 8 : 0
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.transform = window.innerWidth <= 768 ? 'scale(1.1)' : 'scale(1.6)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.transform = 'scale(1)';
                            }}
                        >
                            {window.innerWidth <= 768 ? 'PNG' : 'GO PNG'}
                        </button>
                    )}

                    {/* Кнопка рендеринга для APNG */}
                    {format === 'apng' && (
                        <button
                            onClick={handleRender}
                            style={{
                                padding: window.innerWidth <= 768 ? '4px 8px' : '6px 12px',
                                background: 'transparent',
                                color: isDarkTheme ? '#ffffff' : '#000000',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: window.innerWidth <= 768 ? '10px' : '12px',
                                transition: 'all 0.2s ease',
                                minWidth: window.innerWidth <= 768 ? '60px' : 'auto',
                                height: window.innerWidth <= 768 ? '26px' : 'auto',
                                order: window.innerWidth <= 768 ? 8 : 0
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.transform = window.innerWidth <= 768 ? 'scale(1.1)' : 'scale(1.6)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.transform = 'scale(1)';
                            }}
                        >
                            {window.innerWidth <= 768 ? 'APNG' : 'GO APNG'}
                        </button>
                    )}

                    <button
                        onClick={onClose}
                        style={{
                            width: window.innerWidth <= 768 ? '24px' : '28px',
                            height: window.innerWidth <= 768 ? '24px' : '28px',
                            background: isDarkTheme ? 'transparent' : 'transparent',
                            color: isDarkTheme ? '#ffffff' : '#000000',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: window.innerWidth <= 768 ? '12px' : '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            order: window.innerWidth <= 768 ? 9 : 0
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.background = 'rgba(255, 59, 48, 0.8)';
                            e.target.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = isDarkTheme ? 'transparent' : 'transparent';
                            e.target.style.color = isDarkTheme ? '#ffffff' : '#000000';
                        }}
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Overlay для выбора области */}
            <div
                ref={overlayRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    cursor: isDragging ? 'grabbing' : 'default',
                    touchAction: 'none'
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
            >
                {/* Единая затемненная область с прозрачным окошком */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(8px)',
                    WebkitMask: `
                        radial-gradient(circle at 0 0, transparent 0, transparent 100%),
                        linear-gradient(white, white)
                    `,
                    WebkitMaskComposite: 'subtract',
                    mask: `
                        radial-gradient(circle at 0 0, transparent 0, transparent 100%),
                        linear-gradient(white, white)
                    `,
                    maskComposite: 'subtract',
                    WebkitMaskPosition: `
                        ${renderArea.x}px ${renderArea.y}px,
                        0 0
                    `,
                    maskPosition: `
                        ${renderArea.x}px ${renderArea.y}px,
                        0 0
                    `,
                    WebkitMaskSize: `
                        ${renderArea.width}px ${renderArea.height}px,
                        100% 100%
                    `,
                    maskSize: `
                        ${renderArea.width}px ${renderArea.height}px,
                        100% 100%
                    `,
                    WebkitMaskRepeat: 'no-repeat, no-repeat',
                    maskRepeat: 'no-repeat, no-repeat',
                    clipPath: `polygon(
                        0% 0%, 
                        0% 100%, 
                        ${renderArea.x}px 100%, 
                        ${renderArea.x}px ${renderArea.y}px, 
                        ${renderArea.x + renderArea.width}px ${renderArea.y}px, 
                        ${renderArea.x + renderArea.width}px ${renderArea.y + renderArea.height}px, 
                        ${renderArea.x}px ${renderArea.y + renderArea.height}px, 
                        ${renderArea.x}px 100%, 
                        100% 100%, 
                        100% 0%
                    )`
                }} />

                {/* Плавающая панель с информацией над областью */}
                <div style={{
                    position: 'absolute',
                    left: renderArea.x + (renderArea.width / 2),
                    top: renderArea.y - 50,
                    transform: 'translateX(-50%)',
                    background: isDarkTheme ? 'transparent' : 'transparent',

                    border: `1px solid ${isDarkTheme ? 'transparent' : 'transparent'}`,
                    padding: '8px 16px',
                    borderRadius: '12px',

                    zIndex: 2002,
                    pointerEvents: 'none',
                    display: 'flex',
                    gap: '24px',
                    alignItems: 'center',
                    fontSize: '20px',
                    fontFamily: 'SF Mono, Monaco, monospace',
                    fontWeight: '600',
                    color: isDarkTheme ? '#ffffff' : '#333333'
                }}>
                    {/* Размер области */}
                    <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}>

                        <span>{Math.round(renderArea.width)} × {Math.round(renderArea.height)}</span>
                    </div>

                    {/* Кадры (только для GIF) */}
                    {format === 'gif' && (
                        <div style={{ 
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>

                            <span>{settings.frameRate * settings.duration}</span>
                            <span style={{ fontSize: '10px', opacity: 0.7 }}>FRAMES</span>
                        </div>
                    )}

                    {/* Размер файла (только для GIF) */}
                    {format === 'gif' && (
                        <div style={{ 
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>

                            <span>{getEstimatedFileSize()}</span>
                        </div>
                    )}
                </div>

                {/*рамка выделения */}
                <div style={{
                    position: 'absolute',
                    left: renderArea.x - 2,
                    top: renderArea.y - 2,
                    width: renderArea.width + 4,
                    height: renderArea.height + 4,
                    border: '1px solid rgba(255, 255, 255, 0.9)',
                    borderRadius: '0px',
                    cursor: 'move',
                    pointerEvents: 'none',
                    boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)',
                    background: 'transparent'
                }}>
                    {/* Угловые маркеры*/}
                    {['nw', 'ne', 'sw', 'se'].map(corner => {
                        let style = {
                            position: 'absolute',
                            width: '10px',
                            height: '10px',
                            pointerEvents: 'auto',
                            background: 'rgba(255, 255, 255, 0.95)',
                            border: '2px solid rgba(0, 0, 0, 0.2)',
                            borderRadius: '4px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                        };

                        switch (corner) {
                            case 'nw': 
                                style = { ...style, top: '-12px', left: '-12px', cursor: 'nw-resize' }; 
                                break;
                            case 'ne': 
                                style = { ...style, top: '-12px', right: '-12px', cursor: 'ne-resize' }; 
                                break;
                            case 'sw': 
                                style = { ...style, bottom: '-12px', left: '-12px', cursor: 'sw-resize' }; 
                                break;
                            case 'se': 
                                style = { ...style, bottom: '-12px', right: '-12px', cursor: 'se-resize' }; 
                                break;
                        }

                        return <div key={corner} style={style} />;
                    })}

                    {/* Боковые маркеры */}
                    {['n', 's', 'w', 'e'].map(side => {
                        let style = {
                            position: 'absolute',
                            pointerEvents: 'auto',
                            background: 'rgba(255, 255, 255, 0.9)',
                            border: '1px solid rgba(0, 0, 0, 0.15)',
                            borderRadius: '3px',
                            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.2)'
                        };

                        switch (side) {
                            case 'n': 
                                style = { 
                                    ...style, 
                                    top: '-8px', 
                                    left: '50%', 
                                    width: '40px', 
                                    height: '12px',
                                    transform: 'translateX(-50%)',
                                    cursor: 'n-resize' 
                                }; 
                                break;
                            case 's': 
                                style = { 
                                    ...style, 
                                    bottom: '-8px', 
                                    left: '50%', 
                                    width: '40px', 
                                    height: '12px',
                                    transform: 'translateX(-50%)',
                                    cursor: 's-resize' 
                                }; 
                                break;
                            case 'w': 
                                style = { 
                                    ...style, 
                                    top: '50%', 
                                    left: '-8px', 
                                    width: '12px', 
                                    height: '40px',
                                    transform: 'translateY(-50%)',
                                    cursor: 'w-resize' 
                                }; 
                                break;
                            case 'e': 
                                style = { 
                                    ...style, 
                                    top: '50%', 
                                    right: '-8px', 
                                    width: '12px', 
                                    height: '40px',
                                    transform: 'translateY(-50%)',
                                    cursor: 'e-resize' 
                                }; 
                                break;
                        }

                        return <div key={side} style={style} />;
                    })}

                    {/* Сетка для лучшей видимости */}
                    <div style={{
                        position: 'absolute',
                        top: '33.33%',
                        left: '0',
                        width: '100%',
                        height: '1px',
                        background: 'rgba(255, 255, 255, 0.3)',
                        pointerEvents: 'none'
                    }} />
                    <div style={{
                        position: 'absolute',
                        top: '66.66%',
                        left: '0',
                        width: '100%',
                        height: '1px',
                        background: 'rgba(255, 255, 255, 0.3)',
                        pointerEvents: 'none'
                    }} />
                    <div style={{
                        position: 'absolute',
                        top: '0',
                        left: '33.33%',
                        width: '1px',
                        height: '100%',
                        background: 'rgba(255, 255, 255, 0.3)',
                        pointerEvents: 'none'
                    }} />
                    <div style={{
                        position: 'absolute',
                        top: '0',
                        left: '66.66%',
                        width: '1px',
                        height: '100%',
                        background: 'rgba(255, 255, 255, 0.3)',
                        pointerEvents: 'none'
                    }} />
                </div>
            </div>
        </div>
    );
};

if (typeof window !== 'undefined') {
    window.RenderAreaSelector = RenderAreaSelector;
} else if (typeof global !== 'undefined') {
    global.RenderAreaSelector = RenderAreaSelector;
} else if (typeof globalThis !== 'undefined') {
    globalThis.RenderAreaSelector = RenderAreaSelector;
} else {
    console.error('Unable to find global object to attach RenderAreaSelector');
}

console.log('RenderAreaSelector.js has finished loading');
