console.log('Loading Toolbar component...');

const Toolbar = ({
    mode, setMode, color, setColor, brushSize, setBrushSize,
    opacity, setOpacity, textureScale, setTextureScale,
    strokeVariation, setStrokeVariation, pressureVariation, setPressureVariation,
    graininess, setGraininess, strokeCount, setStrokeCount,
    grainSize, setGrainSize, addImage, undo, redo, clearCanvas, saveCanvas,
    canvas, setModalImageSrc, setShowIOSModal, setModalMessage,
    showGifAreaSelector, showApngAreaSelector, toggleLayersPanel, isLayersPanelVisible,
    onDuplicate, isFarcasterApp, farcasterSDK // Добавлены пропсы isFarcasterApp и farcasterSDK
}) => {
    const [showBrushMenu, setShowBrushMenu] = React.useState(false);
    const [previewAnimationFrame, setPreviewAnimationFrame] = React.useState(null);

    const [isDarkTheme, setIsDarkTheme] = React.useState(true);
    const [isAnimated, setIsAnimated] = React.useState(true);
    const [isInFavorites, setIsInFavorites] = React.useState(false);
    const [animationSettings, setAnimationSettings] = React.useState({
        pulseScale: 0.15,
        rotationSpeed: 0,
        moveAmplitude: 0.2,
        skewAmount: 2,
        opacityRange: 0,
        enablePulse: true,
        enableRotation: true,
        enableOpacity: true,
        enableMove: true
    });
    const brushMenuRef = React.useRef(null);
    const brushPreviewRef = React.useRef(null);
    const colorInputRef = React.useRef(null);
    const timeoutRef = React.useRef(null);
    const fileInputRef = React.useRef(null);

    // Определяем мобильные устройства и iOS
    const isMobile = React.useMemo(() => {
        return window.innerWidth <= 768 || /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }, []);

    const isIOS = React.useMemo(() => {
        return /iPhone|iPad|iPod/i.test(navigator.userAgent);
    }, []);

    // Применяем тему
    React.useEffect(() => {
        const body = document.body;
        if (isDarkTheme) {
            body.classList.add('dark-theme');
        } else {
            body.classList.remove('dark-theme');
        }
    }, [isDarkTheme]);

    // Обработчик изменения темы
    const toggleTheme = React.useCallback(() => {
        // Получаем canvas контейнер
        const canvasContainer = document.getElementById('canvas-container');

        if (canvasContainer) {
            // Устанавливаем CSS переменные для плавного перехода
            if (isDarkTheme) {
                // Переход с темной на светлую
                canvasContainer.style.setProperty('--from-bg-image', 'radial-gradient(#1c1c1c 1px, transparent 1px)');
                canvasContainer.style.setProperty('--from-bg-color', '#000000');
                canvasContainer.style.setProperty('--to-bg-image', 'radial-gradient(#d0d0d0 1px, transparent 1px)');
                canvasContainer.style.setProperty('--to-bg-color', 'transparent');
            } else {
                // Переход со светлой на темную
                canvasContainer.style.setProperty('--from-bg-image', 'radial-gradient(#d0d0d0 1px, transparent 1px)');
                canvasContainer.style.setProperty('--from-bg-color', 'transparent');
                canvasContainer.style.setProperty('--to-bg-image', 'radial-gradient(#1c1c1c 1px, transparent 1px)');
                canvasContainer.style.setProperty('--to-bg-color', '#000000');
            }

            // Добавляем класс анимации
            canvasContainer.classList.add('theme-transition');

            // Удаляем класс после анимации
            setTimeout(() => {
                canvasContainer.classList.remove('theme-transition');
            }, 500);
        }

        setIsDarkTheme(!isDarkTheme);
        localStorage.setItem('isDarkTheme', !isDarkTheme);
    }, [isDarkTheme]);

    // Загружаем сохраненную тему при запуске
    React.useEffect(() => {
        const savedTheme = localStorage.getItem('isDarkTheme');
        if (savedTheme !== null) {
            setIsDarkTheme(JSON.parse(savedTheme));
        }
    }, []);

    // Проверяем статус при загрузке
    React.useEffect(() => {
        if (isFarcasterApp && farcasterSDK) {
            farcasterSDK.context.then(context => {
                const added = context.client?.added || false;
                setIsInFavorites(added);
                console.log('💾 App in favorites:', added);
            }).catch(error => {
                console.error('Error getting context:', error);
            });
        }
    }, [isFarcasterApp, farcasterSDK]);

    // ИСПРАВЛЕННАЯ функция добавления изображения для iOS
    // Хаптическая обратная связь
    const triggerHaptic = React.useCallback(async (type, intensity = 'light') => {
        if (isFarcasterApp && farcasterSDK) {
            try {
                if (type === 'impact') {
                    await farcasterSDK.haptics.impactOccurred(intensity);
                } else if (type === 'selection') {
                    await farcasterSDK.haptics.selectionChanged();
                } else if (type === 'notification') {
                    await farcasterSDK.haptics.notificationOccurred(intensity);
                }
            } catch (error) {
                console.log('Haptic feedback not available:', error);
            }
        }
    }, [isFarcasterApp, farcasterSDK]);

    const handleAddImage = React.useCallback(() => {
        console.log('Adding image, iOS:', isIOS);

        // Хаптическая обратная связь при нажатии
        triggerHaptic('selection');

        if (!canvas) {
            console.error('Canvas not available');
            return;
        }

        // Создаем скрытый input для файлов
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,image/heic,image/heif'; // Добавляем поддержку HEIC для iOS
        input.style.display = 'none';

        // Для iOS добавляем capture для доступа к камере
        if (isIOS) {
            input.setAttribute('capture', 'environment');
        }

        input.onchange = (e) => {
            console.log('File selected');
            const file = e.target.files[0];
            if (!file) {
                console.log('No file selected');
                return;
            }

            console.log('File type:', file.type, 'File size:', file.size);

            const reader = new FileReader();
            reader.onload = (event) => {
                console.log('File loaded');
                const imgObj = new Image();
                imgObj.crossOrigin = 'anonymous'; // Для работы с CORS

                imgObj.onload = () => {
                    console.log('Image loaded, creating fabric image');
                    try {
                        const image = new fabric.Image(imgObj, {
                            left: 100,
                            top: 100,
                            scaleX: 0.5,
                            scaleY: 0.5,
                        });
                        canvas.add(image);
                        canvas.setActiveObject(image);
                        canvas.renderAll();
                        console.log('Image added to canvas');

                        // Вызываем addToHistory если доступна
                        if (typeof addToHistory === 'function') {
                            addToHistory();
                        }
                    } catch (error) {
                        console.error('Error creating fabric image:', error);
                        alert('Ошибка при добавлении изображения');
                    }
                };

                imgObj.onerror = (error) => {
                    console.error('Error loading image:', error);
                    alert('Ошибка при загрузке изображения');
                };

                imgObj.src = event.target.result;
            };

            reader.onerror = (error) => {
                console.error('Error reading file:', error);
                alert('Ошибка при чтении файла');
            };

            reader.readAsDataURL(file);
        };

        // Добавляем input в DOM и кликаем
        document.body.appendChild(input);

        // Для iOS нужна небольшая задержка
        if (isIOS) {
            setTimeout(() => {
                input.click();
                // Удаляем input через секунду
                setTimeout(() => {
                    document.body.removeChild(input);
                }, 1000);
            }, 100);
        } else {
            input.click();
            // Для desktop удаляем сразу после использования
            setTimeout(() => {
                if (document.body.contains(input)) {
                    document.body.removeChild(input);
                }
            }, 1000);
        }
    }, [canvas, isIOS]);

    // Обновляем превью при открытии меню
    React.useEffect(() => {
        let animationId = null;
        let previewCanvas = null;
        
        if (showBrushMenu && brushPreviewRef.current) {
            // Отменяем предыдущую анимацию ПЕРЕД созданием новой
            if (previewAnimationFrame) {
                cancelAnimationFrame(previewAnimationFrame);
                setPreviewAnimationFrame(null);
            }

            previewCanvas = new fabric.Canvas(brushPreviewRef.current);
            previewCanvas.setDimensions({ width: 200, height: 200 });
            previewCanvas.backgroundColor = 'transparent';

            const brush = new fabric.CrayonBrush(previewCanvas);
            brush.color = color;
            brush.width = brushSize;
            brush.opacity = opacity;
            brush.textureScale = textureScale;
            brush.strokeVariation = strokeVariation;
            brush.pressureVariation = pressureVariation;
            brush.graininess = graininess;
            brush.strokeCount = strokeCount;
            brush.grainSize = grainSize;

            // Применяем текущие настройки анимации из состояния
            brush.animated = isAnimated;
            brush.animationSettings = animationSettings;

            previewCanvas.clear();
            previewCanvas.backgroundColor = 'transparent';

            const startPoint = { x: 60, y: 100 };
            const endPoint = { x: 140, y: 100 };

            brush.onMouseDown(startPoint);
            brush.onMouseMove(endPoint);
            brush.onMouseUp();

            // Запускаем анимацию если нужно
            if (brush.animated && showBrushMenu) {
                const animate = () => {
                    if (!showBrushMenu || !isAnimated) return;
                    
                    const objects = previewCanvas.getObjects();
                    animateObjects(previewCanvas, objects);
                    animationId = requestAnimationFrame(animate);
                };
                
                animationId = requestAnimationFrame(animate);
                setPreviewAnimationFrame(animationId);
            }
        }

        // Очистка при размонтировании или изменении зависимостей
        return () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
            if (previewCanvas) {
                previewCanvas.dispose();
            }
        };
    }, [showBrushMenu, color, brushSize, opacity, textureScale, strokeVariation, pressureVariation, graininess, strokeCount, grainSize, isAnimated, animationSettings, animateObjects]);

    // Функция для анимации объектов (переиспользуемая)
    const animateObjects = React.useCallback((canvas, objects) => {
        objects.forEach(obj => {
            if (obj.animated) {
                obj.animationTime = (obj.animationTime || 0) + 0.5;
                const settings = obj.animationSettings;

                const pulseScale = 1 + Math.sin(obj.animationTime * 0.8) * settings.pulseScale;
                obj.scaleX = pulseScale;
                obj.scaleY = pulseScale;

                obj.angle += Math.sin(obj.animationTime * settings.rotationSpeed) * 2;

                obj.opacity = settings.opacityRange > 0 ?
                    1 + Math.sin(obj.animationTime * 0.4) * settings.opacityRange :
                    1;

                obj.left += Math.sin(obj.animationTime * 0.3) * settings.moveAmplitude;
                obj.top += Math.cos(obj.animationTime * 0.2) * settings.moveAmplitude;

                obj.skewX = Math.sin(obj.animationTime * 0.25) * (settings.skewAmount || 5);
                obj.skewY = Math.cos(obj.animationTime * 0.25) * (settings.skewAmount || 5);
            }
        });
        canvas.renderAll();
    }, []);

    


    // Обработчик кликов и сенсорных событий по всему документу
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            // Проверяем, если клик был вне меню кисточки И не на кнопке кисточки, скрываем меню
            const brushButton = event.target.closest('button i.fa-paint-brush')?.parentElement;
            const isClickOnBrushButton = brushButton && (brushButton.contains(event.target) || event.target === brushButton);

            if (brushMenuRef.current && !brushMenuRef.current.contains(event.target) && !isClickOnBrushButton) {
                setShowBrushMenu(false);
            }
        };

        // Обработчик изменения ориентации и размера экрана для мобильных
        const handleViewportChange = () => {
            if (isMobile && showBrushMenu) {
                // Небольшая задержка для корректного пересчета после поворота
                setTimeout(() => {
                    if (brushMenuRef.current) {
                        brushMenuRef.current.style.maxHeight = `calc(100vh - 120px - env(safe-area-inset-bottom, 0px))`;
                    }
                }, 100);
            }
        };

        // Добавляем слушатели событий для мыши и сенсорных экранов
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);

        // Добавляем слушатели для изменения viewport на мобильных
        if (isMobile) {
            window.addEventListener('orientationchange', handleViewportChange);
            window.addEventListener('resize', handleViewportChange);
        }

        return () => {
            // Удаляем слушатели событий при размонтировании компонента
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);

            if (isMobile) {
                window.removeEventListener('orientationchange', handleViewportChange);
                window.removeEventListener('resize', handleViewportChange);
            }
        };
    }, [isMobile, showBrushMenu]);

    // Применяем настройки анимации к кисти при их изменении
    React.useEffect(() => {
        if (canvas && canvas.freeDrawingBrush) {
            canvas.freeDrawingBrush.animated = isAnimated;
            canvas.freeDrawingBrush.animationSettings = animationSettings;
        }
    }, [canvas, isAnimated, animationSettings]);

    // Очистка анимации превью при размонтировании компонента
    React.useEffect(() => {
        return () => {
            if (previewAnimationFrame) {
                cancelAnimationFrame(previewAnimationFrame);
                setPreviewAnimationFrame(null);
            }
        };
    }, []);

    const handleMouseEnter = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setShowBrushMenu(false);
        }, 1000);
    };

    const handleColorChange = (event) => {
        setColor(event.target.value);
    };

    return (
        <>
            <div id="toolbar">
                <div className="tool-group">
                    <button onClick={() => {console.log('Select mode'); triggerHaptic('selection'); setMode('select'); setShowBrushMenu(false);}} className={mode === 'select' || mode === 'pointer' ? 'active' : ''}>
                        <i className="fas fa-mouse-pointer"></i>
                    </button>
                    {/* НОВОЕ: Кнопка руки для перемещения */}
                    <button onClick={() => {console.log('Pan mode'); triggerHaptic('selection'); setMode('pan'); setShowBrushMenu(false);}} className={mode === 'pan' ? 'active' : ''} title="space">
                        <i className="fas fa-hand-paper"></i>
                    </button>
                    <button onClick={() => {console.log('Text mode'); triggerHaptic('selection'); setMode('text'); setShowBrushMenu(false);}} className={mode === 'text' ? 'active' : ''}>
                        <i className="fas fa-font"></i>
                    </button>
                    <button onClick={(event) => {
                        event.stopPropagation();
                        console.log('Brush mode');
                        triggerHaptic('selection');
                        if (mode !== 'brush') {
                            setMode('brush');
                            setShowBrushMenu(true);
                        } else {
                            setShowBrushMenu(!showBrushMenu);
                        }
                    }} className={mode === 'brush' ? 'active' : ''}>
                        <i className="fas fa-paint-brush"></i>
                    </button>
                    <button style={{ padding: 0, background: 'none', border: 'none' }}>
                        <input
                            ref={colorInputRef}
                            type="color"
                            value={color}
                            onChange={handleColorChange}
                        />
                    </button>
                    <button onClick={handleAddImage}>
                        <i className="fas fa-image"></i>
                    </button>
                    <button onClick={() => {console.log('Undo'); triggerHaptic('impact', 'light'); undo();}}>
                        <i className="fas fa-undo"></i>
                    </button>
                    <button onClick={() => {console.log('Redo'); triggerHaptic('impact', 'light'); redo();}}>
                        <i className="fas fa-redo"></i>
                    </button>
                    <button onClick={() => {console.log('Clear canvas'); triggerHaptic('impact', 'medium'); clearCanvas();}}>
                        <i className="fas fa-trash"></i>
                    </button>
                    <button onClick={() => {
        if (canvas) {
            const center = { x: canvas.width / 2, y: canvas.height / 2 };
            const currentZoom = canvas.getZoom();
            const newZoom = Math.min(currentZoom * 1.2, 20);
            canvas.zoomToPoint(center, newZoom);
            canvas.renderAll();
        }
    }}>
                        <i className="fas fa-search-plus"></i>
                    </button>
                    <button onClick={() => {
        if (canvas) {
            const center = { x: canvas.width / 2, y: canvas.height / 2 };
            const currentZoom = canvas.getZoom();
            const newZoom = Math.max(currentZoom * 0.8, 0.05);
            canvas.zoomToPoint(center, newZoom);
            canvas.renderAll();
        }
    }}>
                        <i className="fas fa-search-minus"></i>
                    </button>
                    <button
                        onClick={() => {triggerHaptic('selection'); toggleLayersPanel();}}
                        className={isLayersPanelVisible ? 'active' : ''}
                        title="layers (F2)"
                    >
                        <i className="fas fa-layer-group"></i>
                    </button>
                    <button
                        onClick={() => {triggerHaptic('selection'); toggleTheme();}}
                        title={isDarkTheme ? "go light side" : "go dark side"}
                    >
                        <i className={isDarkTheme ? "fas fa-sun" : "fas fa-moon"}></i>
                    </button>
                    <button
                        onClick={() => {
                            console.log('Opening render area selector');
                            triggerHaptic('impact', 'light');
                            showGifAreaSelector();
                        }}
                        title="Save Image/Animation"
                    >
                        <i className="fas fa-save"></i>
                    </button>

                        {/* Кнопка Share - только в Farcaster */}
                        {isFarcasterApp && farcasterSDK && (
                            <button
                                onClick={async () => {
                                    try {
                                        console.log('📤 Sharing creation...');
                                        const result = await farcasterSDK.actions.composeCast({
                                            text: "Just created something amazing with alfatapes! 🎨✨",
                                            embeds: [`${window.location.origin}/?miniApp=true`]
                                        });
                                        console.log('✅ Share successful:', result);
                                    } catch (error) {
                                        console.error('❌ Share failed:', error);
                                    }
                                }}
                                title="Share your creation"
                                style={{
                                    background: 'linear-gradient(45deg, #ff6b35, #f7931e)',
                                    color: 'white'
                                }}
                            >
                                <i className="fas fa-share-alt"></i>
                            </button>
                        )}

                        {/* Кнопка добавления в избранное - показывается только если НЕ добавлено */}
                        {isFarcasterApp && farcasterSDK && !isInFavorites && (
                            <button
                                onClick={async () => {
                                    try {
                                        console.log('⭐ Adding to favorites...');
                                        await farcasterSDK.actions.addMiniApp();
                                        console.log('✅ Successfully added to favorites!');

                                        // Скрываем кнопку после успешного добавления
                                        setIsInFavorites(true);

                                        // Опционально: показать уведомление
                                        // alert('✅ alfatapes added to your favorites!');
                                    } catch (error) {
                                        console.error('❌ Failed to add to favorites:', error);

                                        if (error.message?.includes('RejectedByUser')) {
                                            console.log('ℹ️ User cancelled adding to favorites');
                                        } else if (error.message?.includes('InvalidDomainManifestJson')) {
                                            console.log('⚠️ Manifest validation error');
                                        } else {
                                            console.log('❌ Unknown error:', error);
                                        }
                                    }
                                }}
                                title="Add to favorites"
                                style={{
                                    background: 'linear-gradient(45deg, #ffd700, #ffed4a)',
                                    color: '#333'
                                }}
                            >
                                <i className="fas fa-star"></i>
                            </button>
                        )}

                </div>
            </div>

            {/* Brush menu rendered separately outside toolbar */}
            {showBrushMenu && (
                <div className="brush-menu" ref={brushMenuRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                    <div className="brush-settings-section">

                        <div className="brush-parameter">
                            <label>Size {brushSize}</label>
                            <input
                                type="range"
                                min="1"
                                max="100"
                                value={brushSize}
                                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                            />
                        </div>
                        <div className="brush-parameter">
                            <label>opacity {opacity}</label>
                            <input
                                type="range"
                                min="0.1"
                                max="1"
                                step="0.1"
                                value={opacity}
                                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                            />
                        </div>
                        <div className="brush-parameter">
                            <label>variation {strokeVariation}</label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={strokeVariation}
                                onChange={(e) => setStrokeVariation(parseFloat(e.target.value))}
                            />
                        </div>
                        <div className="brush-parameter">
                            <label>pressure {pressureVariation}</label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={pressureVariation}
                                onChange={(e) => setPressureVariation(parseFloat(e.target.value))}
                            />
                        </div>
                        <div className="brush-parameter">
                            <label>count {strokeCount}</label>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                step="1"
                                value={strokeCount}
                                onChange={(e) => setStrokeCount(parseInt(e.target.value))}
                            />
                        </div>
                    </div>

                    <div className="brush-settings-section">

                        <div className="brush-parameter">
                            <label>texture {textureScale}</label>
                            <input
                                type="range"
                                min="1"
                                max="5"
                                step="0.1"
                                value={textureScale}
                                onChange={(e) => setTextureScale(parseFloat(e.target.value))}
                            />
                        </div>
                        <div className="brush-parameter">
                            <label>graininess {graininess}</label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={graininess}
                                onChange={(e) => setGraininess(parseFloat(e.target.value))}
                            />
                        </div>
                        <div className="brush-parameter">
                            <label>grain {grainSize}</label>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                step="1"
                                value={grainSize}
                                onChange={(e) => setGrainSize(parseInt(e.target.value))}
                            />
                        </div>
                    <canvas ref={brushPreviewRef} id="brush-preview"></canvas>
                    </div>

                    <div className="brush-settings-section">

                        <div style={{display: 'flex', alignItems: 'center', marginBottom: '10px'}}>
                            <input
                                type="checkbox"
                                id="animate-brush"
                                checked={isAnimated}
                                onChange={(e) => {
                                    const isChecked = e.target.checked;
                                    setIsAnimated(isChecked);
                                    if (canvas && canvas.freeDrawingBrush) {
                                        canvas.freeDrawingBrush.animated = isChecked;
                                        canvas.freeDrawingBrush.animationSettings = animationSettings;

                                        if (!isChecked && previewAnimationFrame) {
                                            cancelAnimationFrame(previewAnimationFrame);
                                            setPreviewAnimationFrame(null);
                                        }
                                    }
                                }}
                            />
                            <label htmlFor="animate-brush">Animation</label>
                        </div>
                        <div className="brush-parameter">
                            <label>pulse {animationSettings.pulseScale}</label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={animationSettings.pulseScale}
                                onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    setAnimationSettings(prev => ({
                                        ...prev,
                                        pulseScale: value,
                                        enablePulse: value > 0
                                    }));
                                    if (canvas && canvas.freeDrawingBrush) {
                                        canvas.freeDrawingBrush.animationSettings = {
                                            ...canvas.freeDrawingBrush.animationSettings,
                                            pulseScale: value,
                                            enablePulse: value > 0
                                        };
                                    }
                                }}
                            />

                            <label>opacity {animationSettings.opacityRange}</label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={animationSettings.opacityRange}
                                onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    setAnimationSettings(prev => ({
                                        ...prev,
                                        opacityRange: value,
                                        enableOpacity: value > 0
                                    }));
                                    if (canvas && canvas.freeDrawingBrush) {
                                        canvas.freeDrawingBrush.animationSettings = {
                                            ...canvas.freeDrawingBrush.animationSettings,
                                            opacityRange: value,
                                            enableOpacity: value > 0
                                        };
                                    }
                                }}
                            />
                        </div>
                        <div className="brush-parameter">
                            <label>rotation {animationSettings.rotationSpeed}</label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={animationSettings.rotationSpeed}
                                onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    setAnimationSettings(prev => ({
                                        ...prev,
                                        rotationSpeed: value,
                                        enableRotation: value > 0
                                    }));
                                    if (canvas && canvas.freeDrawingBrush) {
                                        canvas.freeDrawingBrush.animationSettings = {
                                            ...canvas.freeDrawingBrush.animationSettings,
                                            rotationSpeed: value,
                                            enableRotation: value > 0
                                        };
                                    }
                                }}
                            />
                        </div>
                        <div className="brush-parameter">
                            <label>move {animationSettings.moveAmplitude}</label>
                            <input
                                type="range"
                                min="0"
                                max="2"
                                step="0.01"
                                value={animationSettings.moveAmplitude}
                                onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    setAnimationSettings(prev => ({
                                        ...prev,
                                        moveAmplitude: value,
                                        enableMove: value > 0
                                    }));
                                    if (canvas && canvas.freeDrawingBrush) {
                                        canvas.freeDrawingBrush.animationSettings = {
                                            ...canvas.freeDrawingBrush.animationSettings,
                                            moveAmplitude: value,
                                            enableMove: value > 0
                                        };
                                    }
                                }}
                            />
                        </div>
                        <div className="brush-parameter">
                            <label>skew {animationSettings.skewAmount}</label>
                            <input
                                type="range"
                                min="0"
                                max="10"
                                step="0.1"
                                value={animationSettings.skewAmount}
                                onChange={(e) => {
                                    const value = parseFloat(e.target.value);
                                    setAnimationSettings(prev => ({
                                        ...prev,
                                        skewAmount: value
                                    }));
                                    if (canvas && canvas.freeDrawingBrush) {
                                        canvas.freeDrawingBrush.animationSettings = {
                                            ...canvas.freeDrawingBrush.animationSettings,
                                            skewAmount: value
                                        };
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

if (typeof window !== 'undefined') {
    window.Toolbar = Toolbar;
} else if (typeof global !== 'undefined') {
    global.Toolbar = Toolbar;
} else if (typeof globalThis !== 'undefined') {
    globalThis.Toolbar = Toolbar;
} else {
    console.error('Unable to find global object to attach Toolbar');
}

console.log('Toolbar.js has finished loading');
