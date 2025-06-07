console.log('Loading App component...');

const App = () => {
    console.log('🎨 alfatapes App loading...');
    console.log('Environment:', {
        isMiniApp: window.isMiniApp,
        hasSDK: !!window.sdk,
        userAgent: navigator.userAgent,
        url: window.location.href,
        params: Object.fromEntries(new URLSearchParams(window.location.search))
    });
    const [canvas, setCanvas] = React.useState(null);
    const [mode, setMode] = React.useState('select');
    const [color, setColor] = React.useState('#7B65C1');
    const [brushSize, setBrushSize] = React.useState(10);
    const [opacity, setOpacity] = React.useState(0.8);
    const [textureScale, setTextureScale] = React.useState(2);
    const [strokeVariation, setStrokeVariation] = React.useState(0.5);
    const [pressureVariation, setPressureVariation] = React.useState(0.3);
    const [graininess, setGraininess] = React.useState(0.7);
    const [strokeCount, setStrokeCount] = React.useState(5);
    const [grainSize, setGrainSize] = React.useState(2);
    const [undoStack, setUndoStack] = React.useState([]);
    const [redoStack, setRedoStack] = React.useState([]);
    const [isUndoRedoOperation, setIsUndoRedoOperation] = React.useState(false);
    const [showIOSModal, setShowIOSModal] = React.useState(false);
    const [modalImageSrc, setModalImageSrc] = React.useState('');
    const [setModalMessage] = React.useState('');
    const [zoomLevel, setZoomLevel] = React.useState(1);
    const [isRenderSelectorVisible, setIsRenderSelectorVisible] = React.useState(false);
    const [pendingRenderFormat, setPendingRenderFormat] = React.useState('png');
    const [isLayersPanelVisible, setIsLayersPanelVisible] = React.useState(false);
    const [isFarcasterApp, setIsFarcasterApp] = React.useState(false);
    const [farcasterSDK, setFarcasterSDK] = React.useState(null);
    const [isSharedContext, setIsSharedContext] = React.useState(false);
    const [sharedCastData, setSharedCastData] = React.useState(null);

    React.useEffect(() => {
        console.log('App component mounted');

        // Проверяем URL параметры для shared кастов (доступны немедленно)
        const urlParams = new URLSearchParams(window.location.search);
        const castHash = urlParams.get('castHash');
        const castFid = urlParams.get('castFid');
        const viewerFid = urlParams.get('viewerFid');
        const isShared = window.location.pathname === '/share' || 
                         window.location.pathname.includes('/share') ||
                         urlParams.get('shared') === 'true' ||
                         castHash || castFid;

        console.log('🔍 URL Analysis:', {
            pathname: window.location.pathname,
            search: window.location.search,
            castHash,
            castFid,
            viewerFid,
            isShared,
            isMiniApp: window.isMiniApp,
            fullUrl: window.location.href
        });

        if (isShared) {
            console.log('🔗 Detected shared cast context:', {
                castHash,
                castFid,
                viewerFid,
                isShared
            });
            
            // Устанавливаем состояние для shared контекста
            setIsSharedContext(true);
            setSharedCastData({
                castHash,
                castFid,
                viewerFid
            });

            // Для shared кастов принудительно включаем Mini App режим
            window.isMiniApp = true;
            setIsFarcasterApp(true);
        }

        // Initialize Farcaster SDK if available
        const initFarcaster = async () => {
            // Более продвинутая проверка Mini App окружения
            const isInMiniAppContext = window.isMiniApp || 
                                     window.location.pathname === '/share' ||
                                     window.location.pathname.includes('/share') ||
                                     castHash || 
                                     isShared ||
                                     window.parent !== window;

            console.log('🔍 Mini App context check:', {
                windowIsMiniApp: window.isMiniApp,
                isSharePath: window.location.pathname.includes('/share'),
                hasCastHash: !!castHash,
                isShared,
                inIframe: window.parent !== window,
                finalDecision: isInMiniAppContext
            });

            if (!isInMiniAppContext) {
                console.log('⏭️ Not in Mini App environment, skipping Farcaster initialization');
                return;
            }

            try {
                console.log('🔄 Initializing Farcaster integration...');

                // Ждем загрузки SDK с увеличенным таймаутом для shared кастов
                const waitForSDK = async () => {
                    let attempts = 0;
                    const maxAttempts = isShared ? 300 : 150; // 30 секунд для shared, 15 для обычных

                    console.log(`⏰ Waiting for SDK (max ${maxAttempts/10}s)...`);

                    while (attempts < maxAttempts) {
                        if (window.sdk && window.sdk.actions && typeof window.sdk.actions.ready === 'function') {
                            console.log(`✅ SDK loaded after ${attempts/10}s`);
                            return window.sdk;
                        }
                        await new Promise(resolve => setTimeout(resolve, 100));
                        attempts++;
                        
                        if (attempts % 50 === 0) {
                            console.log(`⏳ Still waiting for SDK... ${attempts/10}s elapsed`);
                        }
                    }
                    throw new Error(`SDK not loaded within timeout (${maxAttempts/10}s)`);
                };

                const sdk = await waitForSDK();
                console.log('✅ SDK loaded, available methods:', Object.keys(sdk));

                // Для shared кастов всегда считаем что мы в Mini App
                let isInMiniAppEnv = true;
                
                // Только для non-shared проверяем SDK
                if (!isShared && !castHash && sdk.isInMiniApp) {
                    try {
                        isInMiniAppEnv = await sdk.isInMiniApp();
                        console.log('🔍 SDK environment check:', isInMiniAppEnv);
                    } catch (error) {
                        console.log('⚠️ Could not verify environment with SDK, assuming true for shared context:', error);
                        isInMiniAppEnv = true;
                    }
                } else {
                    console.log('🔗 Shared context detected, skipping SDK environment check');
                }

                if (isInMiniAppEnv || isShared || castHash) {
                    setFarcasterSDK(sdk);
                    setIsFarcasterApp(true);
                    console.log('✅ Farcaster SDK initialized successfully');

                    // Получаем контекст приложения
                    try {
                        const context = await sdk.context;
                        console.log('📋 Farcaster context received');

                        // Безопасное получение данных пользователя
                        try {
                            const user = context.user;
                            const location = context.location;
                            const client = context.client;

                            console.log('👤 User info:', {
                                fid: user?.fid,
                                username: user?.username,
                                displayName: user?.displayName
                            });

                            console.log('📍 Location:', location?.type);
                            console.log('🖥️ Client:', client?.clientFid);

                            // Проверяем, есть ли shared cast
                            if (location?.type === 'cast_share' && location.cast) {
                                console.log('🔗 Cast shared to app:', location.cast);
                                
                                const cast = location.cast;
                                setIsSharedContext(true);
                                setSharedCastData({
                                    cast: cast,
                                    author: cast.author,
                                    hash: cast.hash,
                                    timestamp: cast.timestamp,
                                    embeds: cast.embeds || []
                                });
                                
                                // Ищем изображения в embeds для автоматической загрузки
                                const imageEmbeds = cast.embeds?.filter(embed => 
                                    typeof embed === 'string' && 
                                    (embed.includes('.jpg') || embed.includes('.png') || embed.includes('.gif'))
                                );
                                
                                if (imageEmbeds && imageEmbeds.length > 0) {
                                    console.log('🖼️ Found image embeds in shared cast:', imageEmbeds);
                                    // Можно автоматически загрузить первое изображение
                                    // loadImageFromUrl(imageEmbeds[0], canvas);
                                }geUrls = cast.embeds?.filter(url => 
                                    typeof url === 'string' && url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                                ) || [];

                                console.log('🖼️ Found images in shared cast:', imageUrls);

                                if (imageUrls.length > 0) {
                                    // Ждем инициализации canvas перед загрузкой изображения
                                    const waitForCanvas = () => {
                                        return new Promise((resolve) => {
                                            const checkCanvas = () => {
                                                if (canvas) {
                                                    resolve();
                                                } else {
                                                    setTimeout(checkCanvas, 100);
                                                }
                                            };
                                            checkCanvas();
                                        });
                                    };

                                    waitForCanvas().then(() => {
                                        console.log('🎨 Loading first image from shared cast');
                                        loadImageFromUrl(imageUrls[0]);
                                    });
                                }
                            }

                        } catch (userError) {
                            console.log('ℹ️ User data not immediately available');
                        }
                    } catch (error) {
                        console.log('⚠️ Could not get context:', error.message);
                    }

                    // Ждем готовности UI перед вызовом ready()
                    const waitForUIReady = () => {
                        return new Promise((resolve) => {
                            requestAnimationFrame(() => {
                                setTimeout(() => {
                                    resolve();
                                }, 800); // Увеличиваем время ожидания
                            });
                        });
                    };

                    await waitForUIReady();

                    // Скрываем splash screen - больше попыток для shared кастов
                    const dismissSplash = async () => {
                        const maxAttempts = isShared ? 5 : 3;
                        const delayBetweenAttempts = isShared ? 1500 : 1000;
                        
                        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                            try {
                                console.log(`🎬 Attempting to dismiss splash screen (attempt ${attempt}/${maxAttempts}) - shared: ${isShared}`);
                                await sdk.actions.ready({
                                    disableNativeGestures: false
                                });
                                console.log('🎉 Farcaster splash screen dismissed successfully');
                                return;
                            } catch (error) {
                                console.error(`❌ Attempt ${attempt} failed:`, error);
                                if (attempt < maxAttempts) {
                                    console.log(`⏳ Waiting ${delayBetweenAttempts}ms before retry...`);
                                    await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
                                }
                            }
                        }
                        console.error('❌ All attempts to dismiss splash screen failed, continuing anyway...');
                        
                        // Для shared кастов продолжаем работу даже если splash не удалось закрыть
                        if (isShared) {
                            console.log('🔄 Shared cast context - continuing despite splash dismissal failure');
                        }
                    };

                    await dismissSplash();
                } else {
                    console.log('⚠️ Not proceeding with SDK initialization');
                }
            } catch (error) {
                console.error('❌ Error initializing Farcaster SDK:', error);
                // Приложение должно работать и без Farcaster
            }
        };

        // Initialize Farcaster in all cases - function will handle environment detection
        initFarcaster();
    }, []);

    const addToHistory = React.useCallback(() => {
        if (canvas && !isUndoRedoOperation) {
            console.log('Adding to history');
            setUndoStack(prevStack => {
                const newStack = [...prevStack, canvas.toJSON(['animated', 'animationTime', 'originalLeft', 'originalTop', 'animationSettings'])];
                console.log('Undo stack updated, length:', newStack.length);
                return newStack;
            });
            setRedoStack([]);
        }
    }, [canvas, isUndoRedoOperation]);

    const undo = React.useCallback(() => {
        if (canvas && undoStack.length > 1) {
            console.log('Undoing action');
            setIsUndoRedoOperation(true);

            const previousState = undoStack[undoStack.length - 2];

            setRedoStack(prevStack => [
                canvas.toJSON(['animated', 'animationTime', 'originalLeft', 'originalTop', 'animationSettings']), 
                ...prevStack
            ]);

            canvas.loadFromJSON(previousState, () => {
                const groups = {};
                previousState.objects.forEach((savedObj, index) => {
                    if (savedObj.type === 'group') {
                        groups[index] = savedObj;
                    }
                });

                canvas.getObjects().forEach((obj, index) => {
                    const savedObj = previousState.objects[index];
                    if (savedObj) {
                        obj.set({
                            left: savedObj.left,
                            top: savedObj.top,
                            scaleX: savedObj.scaleX,
                            scaleY: savedObj.scaleY,
                            angle: savedObj.angle,
                            skewX: savedObj.skewX,
                            skewY: savedObj.skewY,
                            flipX: savedObj.flipX,
                            flipY: savedObj.flipY,
                            originX: savedObj.originX,
                            originY: savedObj.originY
                        });

                        if (savedObj.group) {
                            const groupData = groups[savedObj.group];
                            if (groupData) {
                                obj.left = savedObj.left + groupData.left;
                                obj.top = savedObj.top + groupData.top;
                                if (groupData.scaleX) obj.scaleX *= groupData.scaleX;
                                if (groupData.scaleY) obj.scaleY *= groupData.scaleY;
                                if (groupData.angle) obj.angle += groupData.angle;
                            }
                        }

                        obj.animated = savedObj.animated || false;
                        if (savedObj.animated) {
                            obj.animationTime = savedObj.animationTime || 0;
                            obj.originalLeft = savedObj.originalLeft || obj.left;
                            obj.originalTop = savedObj.originalTop || obj.top;
                            obj.animationSettings = savedObj.animationSettings ? 
                                {...savedObj.animationSettings} : {
                                    pulseScale: 0.15,
                                    rotationSpeed: 0.3,
                                    opacityRange: 0.4,
                                    moveAmplitude: 0.8,
                                    skewAmount: 5
                                };
                        }
                    }
                });
                canvas.renderAll();
                setIsUndoRedoOperation(false);
            });
            setUndoStack(prevStack => prevStack.slice(0, -1));
        }
    }, [canvas, undoStack]);

    const redo = React.useCallback(() => {
        if (canvas && redoStack.length > 0) {
            console.log('Redoing action');
            setIsUndoRedoOperation(true);
            const nextState = redoStack[0];
            setUndoStack(prevStack => [...prevStack, canvas.toJSON(['animated', 'animationTime', 'originalLeft', 'originalTop', 'animationSettings'])]);
            canvas.loadFromJSON(nextState, () => {
                canvas.getObjects().forEach((obj, index) => {
                    const savedObj = nextState.objects[index];
                    if (savedObj) {
                        obj.animated = savedObj.animated || false;
                        if (savedObj.animated) {
                            obj.animationTime = savedObj.animationTime || 0;
                            obj.originalLeft = savedObj.originalLeft || obj.left;
                            obj.originalTop = savedObj.originalTop || obj.top;
                            obj.animationSettings = savedObj.animationSettings ? 
                                {...savedObj.animationSettings} : {
                                    pulseScale: 0.15,
                                    rotationSpeed: 0.3,
                                    opacityRange: 0.4,
                                    moveAmplitude: 0.8,
                                    skewAmount: 5
                                };
                        }
                    }
                });
                canvas.renderAll();
                setIsUndoRedoOperation(false);
            });
            setRedoStack(prevStack => prevStack.slice(1));
        }
    }, [canvas, redoStack]);

    const addImage = React.useCallback(() => {
        if (canvas) {
            console.log('Adding image');
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = (event) => {
                    const imgObj = new Image();
                    imgObj.src = event.target.result;
                    imgObj.onload = () => {
                        const image = new fabric.Image(imgObj);
                        image.scale(0.5);
                        image.id = `image_${Date.now()}`;
                        image.name = `Image ${canvas.getObjects().length + 1}`;
                        canvas.add(image);
                        canvas.renderAll();
                        addToHistory();
                    };
                };
                reader.readAsDataURL(file);
            };
            input.click();
        }
    }, [canvas, addToHistory]);

    const clearCanvas = React.useCallback(async () => {
        if (canvas) {
            console.log('Clearing canvas');
            canvas.clear();
            canvas.backgroundColor = 'transparent';
            canvas.renderAll();
            addToHistory();

            // Хаптическая обратная связь для успешной очистки
            if (isFarcasterApp && farcasterSDK) {
                try {
                    await farcasterSDK.haptics.notificationOccurred('success');
                } catch (error) {
                    console.log('Haptic feedback not available:', error);
                }
            }
        }
    }, [canvas, addToHistory, isFarcasterApp, farcasterSDK]);

    const createGroup = React.useCallback(() => {
        if (!canvas) return;

        const activeSelection = canvas.getActiveObject();
        if (!activeSelection || activeSelection.type !== 'activeSelection') {
            alert('select some');
            return;
        }

        const group = new fabric.Group(activeSelection.getObjects(), {
            id: `group_${Date.now()}`,
            name: `Group ${canvas.getObjects().filter(obj => obj.type === 'group').length + 1}`,
        });

        activeSelection.forEachObject(obj => {
            canvas.remove(obj);
        });

        canvas.add(group);
        canvas.setActiveObject(group);
        canvas.renderAll();
        addToHistory();
    }, [canvas, addToHistory]);

    const ungroupObjects = React.useCallback(() => {
        if (!canvas) return;

        const activeObject = canvas.getActiveObject();
        if (!activeObject || activeObject.type !== 'group') {
            alert('select group');
            return;
        }

        const objects = activeObject.getObjects();
        canvas.remove(activeObject);

        objects.forEach(obj => {

            if (!obj.id) obj.id = `obj_${Date.now()}_${Math.random()}`;
            if (!obj.name) obj.name = `Object ${canvas.getObjects().length + 1}`;
            canvas.add(obj);
        });

        canvas.renderAll();
        addToHistory();
    }, [canvas, addToHistory]);


    const showGifAreaSelector = React.useCallback((format = 'png') => {
        setPendingRenderFormat(format);
        setIsRenderSelectorVisible(true);
    }, []);


    const showApngAreaSelector = React.useCallback(() => {
        setPendingRenderFormat('apng');
        setIsRenderSelectorVisible(true);
    }, []);

    // GIF 
    const renderGifFromAreaWithSettings = React.useCallback(async (area, settings, progressCallback) => {
        if (!canvas) return;

        console.log('Rendering GIF with settings:', settings);


        const canvasElement = canvas.getElement();
        const canvasRect = canvasElement.getBoundingClientRect();
        const sourceX = area.x - canvasRect.left;
        const sourceY = area.y - canvasRect.top;

        const outputWidth = Math.round(settings.width);
        const outputHeight = Math.round(settings.height);

        const gif = new GIF({
            workers: settings.workers,
            quality: settings.quality,
            width: outputWidth,
            height: outputHeight,
            workerScript: './gif.worker.js',
            background: settings.background,
            repeat: settings.repeat,
            transparent: settings.transparent,
            dither: settings.dither
        });

        let frames = 0;
        const totalFrames = Math.round(settings.frameRate * settings.duration);
        const delay = settings.delay;

        const animatedObjects = canvas.getObjects().filter(obj => obj.animated);
        const originalStates = animatedObjects.map(obj => ({
            obj,
            left: obj.left,
            top: obj.top,
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            angle: obj.angle,
            opacity: obj.opacity,
            skewX: obj.skewX,
            skewY: obj.skewY
        }));

        function captureFrame() {
            if (frames >= totalFrames) {
                originalStates.forEach(state => {
                    state.obj.set({
                        left: state.left,
                        top: state.top,
                        scaleX: state.scaleX,
                        scaleY: state.scaleY,
                        angle: state.angle,
                        opacity: state.opacity,
                        skewX: state.skewX,
                        skewY: state.skewY
                    });
                });
                canvas.renderAll();
                gif.render();
                return;
            }

            animatedObjects.forEach(obj => {
                if (obj.animated) {
                    obj.animationTime = (obj.animationTime || 0) + 0.5;
                }
            });

            canvas.renderAll();

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = outputWidth;
            tempCanvas.height = outputHeight;
            const tempCtx = tempCanvas.getContext('2d');

            tempCtx.drawImage(
                canvasElement,
                sourceX, sourceY, area.width, area.height,
                0, 0, outputWidth, outputHeight
            );

            gif.addFrame(tempCanvas, { delay: delay, copy: settings.copy });

            frames++;
            const frameProgress = (frames / totalFrames) * 50; // 50% 
            if (progressCallback) progressCallback(frameProgress);

            setTimeout(captureFrame, 16); // ~60fps 
        }

        return new Promise((resolve, reject) => {
            gif.on('progress', function(p) {
                const totalProgress = 50 + (p * 50); 
                if (progressCallback) progressCallback(totalProgress);
            });

            gif.on('finished', function(blob) {
                const url = URL.createObjectURL(blob);
                const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

                if (isIOS) {
                    setModalImageSrc(url);
                    setShowIOSModal(true);
                } else {
                    const link = document.createElement('a');
                    link.download = 'alfatapes.gif';
                    link.href = url;
                    link.click();
                    URL.revokeObjectURL(url);
                }

                resolve();
            });

            gif.on('error', function(error) {
                reject(error);
            });

            captureFrame();
        });
    }, [canvas, setModalImageSrc, setShowIOSModal]);

    // APNG 
    const renderApngFromArea = React.useCallback((area) => {
        if (!canvas) return;

        const loadingMessage = document.createElement('div');
        loadingMessage.style.position = 'fixed';
        loadingMessage.style.top = '50%';
        loadingMessage.style.left = '50%';
        loadingMessage.style.transform = 'translate(-50%, -50%)';
        loadingMessage.style.background = 'rgba(0,0,0,0.8)';
        loadingMessage.style.color = 'white';
        loadingMessage.style.padding = '20px';
        loadingMessage.style.borderRadius = '10px';
        loadingMessage.textContent = 'Creating APNG...';
        document.body.appendChild(loadingMessage);

        if (typeof pako === 'undefined' || typeof UPNG === 'undefined') {
            document.body.removeChild(loadingMessage);
            alert('APNG libraries not loaded. Please refresh the page.');
            return;
        }

        const canvasElement = canvas.getElement();
        const canvasRect = canvasElement.getBoundingClientRect();

        const sourceX = area.x - canvasRect.left;
        const sourceY = area.y - canvasRect.top;

        const finalWidth = Math.round(area.width);
        const finalHeight = Math.round(area.height);

        let frames = 0;
        const totalFrames = 60;
        const frameDelay = 33;
        const frameBuffers = [];
        const delays = [];

        const animatedObjects = canvas.getObjects().filter(obj => obj.animated);
        const originalStates = animatedObjects.map(obj => ({
            obj,
            left: obj.left,
            top: obj.top,
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            angle: obj.angle,
            opacity: obj.opacity,
            skewX: obj.skewX,
            skewY: obj.skewY
        }));

        function captureFrame() {
            if (frames >= totalFrames) {
                originalStates.forEach(state => {
                    state.obj.set({
                        left: state.left,
                        top: state.top,
                        scaleX: state.scaleX,
                        scaleY: state.scaleY,
                        angle: state.angle,
                        opacity: state.opacity,
                        skewX: state.skewX,
                        skewY: state.skewY
                    });
                });
                canvas.renderAll();
                createApng();
                return;
            }

            animatedObjects.forEach(obj => {
                if (obj.animated) {
                    obj.animationTime = (obj.animationTime || 0) + 0.5;
                }
            });

            canvas.renderAll();

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = finalWidth;
            tempCanvas.height = finalHeight;
            const tempCtx = tempCanvas.getContext('2d');

            tempCtx.drawImage(
                canvasElement,
                sourceX, sourceY, area.width, area.height,
                0, 0, finalWidth, finalHeight
            );

            const imageData = tempCtx.getImageData(0, 0, finalWidth, finalHeight);
            frameBuffers.push(imageData.data.buffer);
            delays.push(frameDelay);

            frames++;
            loadingMessage.textContent = `Creating APNG... ${Math.round((frames / totalFrames) * 100)}% (Capturing frames)`;

            setTimeout(captureFrame, 5);
        }

        function createApng() {
            try {
                loadingMessage.textContent = 'Creating APNG... (Encoding)';

                const apngBuffer = UPNG.encode(
                    frameBuffers, 
                    finalWidth, 
                    finalHeight, 
                    0,
                    delays,
                    0
                );

                const blob = new Blob([apngBuffer], { type: 'image/png' });
                document.body.removeChild(loadingMessage);

                const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

                if (isIOS) {
                    const reader = new FileReader();
                    reader.onload = function() {
                        setModalImageSrc(reader.result);
                        setShowIOSModal(true);
                    };
                    reader.readAsDataURL(blob);
                } else {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = 'alfatapes.apng';
                    link.href = url;
                    link.click();
                    setTimeout(() => {
                        URL.revokeObjectURL(url);
                    }, 100);
                }
            } catch (error) {
                document.body.removeChild(loadingMessage);
                console.error('Error creating APNG:', error);
                alert(`Error creating APNG: ${error.message || 'Unknown error'}`);
            }
        }

        captureFrame();
    }, [canvas, setModalImageSrc, setShowIOSModal]);

    // PNG рендеринг из области
    const renderPngFromArea = React.useCallback((area) => {
        if (!canvas) return;

        const canvasElement = canvas.getElement();
        const canvasRect = canvasElement.getBoundingClientRect();

        const sourceX = area.x - canvasRect.left;
        const sourceY = area.y - canvasRect.top;

        const finalWidth = Math.round(area.width);
        const finalHeight = Math.round(area.height);

        // Создаем временный canvas для захвата области
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = finalWidth;
        tempCanvas.height = finalHeight;
        const tempCtx = tempCanvas.getContext('2d');

        // Рисуем выбранную область на временном canvas
        tempCtx.drawImage(
            canvasElement,
            sourceX, sourceY, area.width, area.height,
            0, 0, finalWidth, finalHeight
        );

        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

        if (isIOS) {
            const dataURL = tempCanvas.toDataURL('image/png', 1.0);
            setModalImageSrc(dataURL);
            setShowIOSModal(true);
        } else {
            if (tempCanvas.toBlob) {
                tempCanvas.toBlob((blob) => {
                    const link = document.createElement('a');
                    link.download = 'alfatapes.png';
                    link.href = URL.createObjectURL(blob);
                    link.click();
                    URL.revokeObjectURL(link.href);
                }, 'image/png', 1.0);
            } else {
                const dataURL = tempCanvas.toDataURL('image/png', 1.0);
                const link = document.createElement('a');
                link.download = 'alfatapes.png';
                link.href = dataURL;
                link.click();
            }
        }
    }, [canvas, setModalImageSrc, setShowIOSModal]);

    const handleRenderArea = React.useCallback((area, format, gifSettings = null, progressCallback = null) => {
        if (!canvas) return;

        console.log('Rendering area:', area, 'format:', format, 'settings:', gifSettings);

        if (format === 'gif' && gifSettings) {

            return renderGifFromAreaWithSettings(area, gifSettings, progressCallback);
        } else if (format === 'gif') {

            setGifRenderArea(area);
            setIsGifSettingsVisible(true);
        } else if (format === 'apng') {
            renderApngFromArea(area);
        } else if (format === 'png') {
            renderPngFromArea(area);
        }
    }, [canvas, renderGifFromAreaWithSettings, renderApngFromArea, renderPngFromArea]);

    const saveCanvas = React.useCallback(() => {
        if (canvas) {
            console.log('Saving canvas');
            canvas.discardActiveObject();
            canvas.renderAll();

            const canvasElement = canvas.getElement();
            const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

            if (isIOS) {
                const dataURL = canvasElement.toDataURL('image/png', 1.0);
                setModalImageSrc(dataURL);
                setShowIOSModal(true);
            } else {
                if (canvasElement.toBlob) {
                    canvasElement.toBlob((blob) => {
                        const link = document.createElement('a');
                        link.download = 'alfatapes.png';
                        link.href = URL.createObjectURL(blob);
                        link.click();
                        URL.revokeObjectURL(link.href);
                    }, 'image/png', 1.0);
                } else {
                    const dataURL = canvasElement.toDataURL('image/png', 1.0);
                    const link = document.createElement('a');
                    link.download = 'alfatapes.png';
                    link.href = dataURL;
                    link.click();
                }
            }
        }
    }, [canvas]);

    const removeSelectedObject = React.useCallback(() => {
        if (canvas) {
            console.log('Removing selected object');
            const activeObject = canvas.getActiveObject();
            if (activeObject) {
                canvas.remove(activeObject);
                canvas.renderAll();
                addToHistory();
            }
        }
    }, [canvas, addToHistory]);

    const flipHorizontally = React.useCallback(() => {
        if (canvas) {
            console.log('Flipping horizontally');
            const activeObject = canvas.getActiveObject();
            if (activeObject) {
                activeObject.set('flipX', !activeObject.flipX);
                canvas.renderAll();
                addToHistory();
            }
        }
    }, [canvas, addToHistory]);



    const toggleLayersPanel = React.useCallback(() => {
        setIsLayersPanelVisible(!isLayersPanelVisible);
    }, [isLayersPanelVisible]);

    // Add canvas to history when first set
    React.useEffect(() => {
        if (canvas && undoStack.length === 0) {
            console.log('Canvas initialized, adding initial state to history');
            addToHistory();
        }
    }, [canvas, addToHistory, undoStack.length]);

    React.useEffect(() => {
        if (canvas) {
            const handleCanvasChange = () => {
                if (!isUndoRedoOperation) {
                    console.log('Canvas changed, adding to history');
                    addToHistory();
                }
            };

            const handleObjectAdded = (e) => {
                const obj = e.target;
                if (!obj.id) {
                    obj.id = `obj_${Date.now()}_${Math.random()}`;
                }
                if (!obj.name) {
                    const type = obj.type;
                    const count = canvas.getObjects().filter(o => o.type === type).length;
                    obj.name = `${type.charAt(0).toUpperCase() + type.slice(1)} ${count}`;
                }

                if (!isUndoRedoOperation) {
                    addToHistory();
                }
            };

            canvas.on('object:added', handleObjectAdded);
            canvas.on('object:removed', handleCanvasChange);
            canvas.on('object:modified', handleCanvasChange);

            return () => {
                canvas.off('object:added', handleObjectAdded);
                canvas.off('object:removed', handleCanvasChange);
                canvas.off('object:modified', handleCanvasChange);
            };
        }
    }, [canvas, addToHistory, isUndoRedoOperation]);

    React.useEffect(() => {
        if (canvas) {
            const updateZoomLevel = () => {
                setZoomLevel(canvas.getZoom());
            };

            canvas.on('after:render', updateZoomLevel);

            return () => {
                canvas.off('after:render', updateZoomLevel);
            };
        }
    }, [canvas]);

    React.useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
                event.preventDefault();
                undo();
            }
            if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.shiftKey && event.key === 'z'))) {
                event.preventDefault();
                redo();
            }

            if ((event.ctrlKey || event.metaKey) && event.key === 'g') {
                event.preventDefault();
                createGroup();
            }
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'G') {
                event.preventDefault();
                ungroupObjects();
            }

            if (event.key === 'F2') {
                event.preventDefault();
                toggleLayersPanel();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [undo, redo, createGroup, ungroupObjects, toggleLayersPanel]);

    const handleDuplicate = React.useCallback(() => {
        if (canvas) {
            console.log('Duplicating object');
            const activeObject = canvas.getActiveObject();
            if (activeObject) {
                setIsUndoRedoOperation(true);

                activeObject.clone((clonedObj) => {
                    if (clonedObj.type === 'activeSelection') {
                        const groupLeft = activeObject.left;
                        const groupTop = activeObject.top;

                        const objects = clonedObj.getObjects().map(obj => {
                            const clonedGroupObj = fabric.util.object.clone(obj);
                            clonedGroupObj.left = obj.left - groupLeft;
                            clonedGroupObj.top = obj.top - groupTop;
                            return clonedGroupObj;
                        });

                        const group = new fabric.Group(objects, {
                            left: groupLeft + 10,
                            top: groupTop + 10,
                            evented: true,
                            id: `group_${Date.now()}`,
                            name: `Group ${canvas.getObjects().filter(obj => obj.type === 'group').length + 1}`
                        });

                        canvas.add(group);
                        canvas.setActiveObject(group);
                    } else {

                        clonedObj.id = `${activeObject.type}_${Date.now()}`;
                        clonedObj.name = `${activeObject.name} Copy`;

                        canvas.add(clonedObj);
                        clonedObj.set({
                            left: clonedObj.left + 10,
                            top: clonedObj.top + 10,
                            evented: true
                        });
                        canvas.setActiveObject(clonedObj);
                    }

                    canvas.requestRenderAll();
                    setIsUndoRedoOperation(false);
                    addToHistory();
                });
            }
        }
    }, [canvas, addToHistory, setIsUndoRedoOperation]);

    console.log('Current undo stack:', undoStack);
    console.log('Current redo stack:', redoStack);

    const ZoomIndicator = ({ zoomLevel }) => (
        <div className="zoom-indicator" style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 'bold',
            zIndex: 1000,
            fontFamily: 'monospace'
        }}>
            {Math.round(zoomLevel * 100)}%
        </div>
    );

    const NavigationHints = () => (
        <div></div>
    )

    const handleFormatChange = (format) => {
        setPendingRenderFormat(format);
    };

    // Функция загрузки изображения из URL (для shared кастов)
    const loadImageFromUrl = React.useCallback(async (imageUrl) => {
        if (!canvas || !imageUrl) {
            console.log('❌ Canvas or image URL not available');
            return;
        }

        console.log('🔄 Loading image from shared cast:', imageUrl);

        try {
            const img = new Image();
            img.crossOrigin = 'anonymous'; // Для работы с CORS

            return new Promise((resolve, reject) => {
                img.onload = () => {
                    console.log('✅ Image loaded successfully');

                    const canvasWidth = canvas.width;
                    const canvasHeight = canvas.height;

                    // Для shared изображений делаем их больше - 60% от меньшей стороны canvas
                    const maxDimension = Math.min(canvasWidth, canvasHeight) * 0.6;

                    let newWidth, newHeight;
                    if (img.width > img.height) {
                        newWidth = Math.min(maxDimension, img.width);
                        newHeight = (img.height / img.width) * newWidth;
                    } else {
                        newHeight = Math.min(maxDimension, img.height);
                        newWidth = (img.width / img.height) * newHeight;
                    }

                    const fabricImage = new fabric.Image(img, {
                        left: (canvasWidth - newWidth) / 2,
                        top: (canvasHeight - newHeight) / 2,
                        scaleX: newWidth / img.width,
                        scaleY: newHeight / img.height,
                        selectable: true,
                        evented: true
                    });

                    // Добавляем метаданные для отслеживания
                    fabricImage.sharedFromCast = true;
                    fabricImage.originalUrl = imageUrl;

                    canvas.add(fabricImage);
                    canvas.setActiveObject(fabricImage);
                    canvas.renderAll();

                    // Добавляем в историю
                    addToHistory();

                    // Автоматически переключаемся в режим select для удобства редактирования
                    setMode('select');

                    console.log('🎨 Image from shared cast added to canvas');
                    resolve();
                };

                img.onerror = (error) => {
                    console.error('❌ Failed to load image from shared cast:', error);
                    console.log('🔄 Trying alternative loading methods...');

                    // Пробуем загрузить через fetch с различными методами обхода CORS
                    const tryProxyLoad = async () => {
                        const proxies = [
                            '', // Прямая загрузка
                            'https://cors-anywhere.herokuapp.com/', // CORS proxy
                            'https://api.allorigins.win/raw?url=' // Alternative proxy
                        ];

                        for (const proxy of proxies) {
                            try {
                                const proxyUrl = proxy + encodeURIComponent(imageUrl);
                                const response = await fetch(proxy ? proxyUrl : imageUrl, {
                                    mode: proxy ? 'cors' : 'no-cors'
                                });
                                
                                if (response.ok || proxy) {
                                    const blob = await response.blob();
                                    const objectUrl = URL.createObjectURL(blob);
                                    img.src = objectUrl;
                                    return;
                                }
                            } catch (proxyError) {
                                console.log(`❌ Proxy ${proxy} failed:`, proxyError);
                            }
                        }
                        
                        console.error('❌ All loading methods failed');
                        reject(new Error('Failed to load image with all methods'));
                    };

                    tryProxyLoad();
                };

                img.src = imageUrl;
            });
        } catch (error) {
            console.error('❌ Error loading image from shared cast:', error);
        }
    }, [canvas, addToHistory, setMode]);

    return (
        <div id="editor">
            <Canvas
                setCanvas={setCanvas}
                mode={mode}
                color={color}
                brushSize={brushSize}
                opacity={opacity}
                textureScale={textureScale}
                strokeVariation={strokeVariation}
                pressureVariation={pressureVariation}
                graininess={graininess}
                strokeCount={strokeCount}
                grainSize={grainSize}
                removeSelectedObject={removeSelectedObject}
                flipHorizontally={flipHorizontally}
                createGroup={createGroup}
                ungroupObjects={ungroupObjects}
                farcasterSDK={farcasterSDK}
                isFarcasterApp={isFarcasterApp}
                isSharedContext={isSharedContext}
                sharedCastData={sharedCastData}
            />
            <Toolbar
                mode={mode}
                setMode={setMode}
                color={color}
                setColor={setColor}
                brushSize={brushSize}
                setBrushSize={setBrushSize}
                opacity={opacity}
                setOpacity={setOpacity}
                textureScale={textureScale}
                setTextureScale={setTextureScale}
                strokeVariation={strokeVariation}
                setStrokeVariation={setStrokeVariation}
                pressureVariation={pressureVariation}
                setPressureVariation={setPressureVariation}
                graininess={graininess}
                setGraininess={setGraininess}
                strokeCount={strokeCount}
                setStrokeCount={setStrokeCount}
                grainSize={grainSize}
                setGrainSize={setGrainSize}
                addImage={addImage}
                undo={undo}
                redo={redo}
                clearCanvas={clearCanvas}
                saveCanvas={saveCanvas}
                canvas={canvas}
                setModalImageSrc={setModalImageSrc}
                setShowIOSModal={setShowIOSModal}
                setModalMessage={setModalMessage}
                showGifAreaSelector={showGifAreaSelector}
                showApngAreaSelector={showApngAreaSelector}
                toggleLayersPanel={toggleLayersPanel}
                isLayersPanelVisible={isLayersPanelVisible}
                onDuplicate={handleDuplicate}
                isFarcasterApp={isFarcasterApp}
                farcasterSDK={farcasterSDK}
            />

            {isRenderSelectorVisible && (
                <RenderAreaSelector
                    canvas={canvas}
                    isVisible={isRenderSelectorVisible}
                    onClose={() => setIsRenderSelectorVisible(false)}
                    onRender={handleRenderArea}
                    format={pendingRenderFormat}
                    onFormatChange={handleFormatChange}
                />
            )}
            {/* панель слоев */}
            <LayersPanel
                canvas={canvas}
                isVisible={isLayersPanelVisible}
                onClose={() => setIsLayersPanelVisible(false)}
            />
            <NavigationHints />
            <ZoomIndicator zoomLevel={zoomLevel} />
            {showIOSModal &&(
                <div id="ios-save-modal" style={{
                    position: 'fixed',
                    top: '0',
                    left: '0',
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    flexDirection: 'column'
                }}>
                    <div style={{
                        backgroundColor: '#fff',
                        padding: '15px',
                        borderRadius: '10px',
                        textAlign: 'center',
                        maxWidth: '90vw',
                        position: 'relative'
                    }}>
                        <h2 style={{ marginBottom: '10px' }}>ios mfer</h2>
                        <p style={{ marginBottom: '10px' }}>tap & hold for saving</p>
                        <img src={modalImageSrc} alt="Artwork" style={{
                            maxWidth: '100%',
                            maxHeight: '40vh',
                            borderRadius: '10px'
                        }} />
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            marginTop: '15px'
                        }}>
                            <button onClick={() => setShowIOSModal(false)} style={{
                                padding: '10px 20px',
                                backgroundColor: '#fff',
                                color: '#333',
                                border: '1px solid #ccc',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                minWidth: '150px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}>
                                close&nbsp;✕
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

if (typeof window !== 'undefined') {
    window.App = App;
} else if (typeof global !== 'undefined') {
    global.App = App;
} else if (typeof globalThis !=='undefined') {
    globalThis.App = App;
} else {
    console.error('Unable to find global object to attach App');
}

console.log('App.js has finished loading');
