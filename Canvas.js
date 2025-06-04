console.log('Canvas.js is loading...');

const Canvas = ({ setCanvas, mode, setMode, color, brushSize, opacity, textureScale, strokeVariation, pressureVariation, graininess, strokeCount, grainSize, flipHorizontally, farcasterSDK, isFarcasterApp }) => {
    const canvasRef = React.useRef(null);
    const fabricCanvasRef = React.useRef(null);
    const [contextMenu, setContextMenu] = React.useState(null);
    const longPressTimer = React.useRef(null);
    const longPressDelay = 500;
    const [zoomLevel, setZoomLevel] = React.useState(1);
    const touchStartPos = React.useRef(null);
    const touchMoved = React.useRef(false);
    const isTouch = React.useRef(false);
    const initialPinchDistance = React.useRef(null);
    const lastZoom = React.useRef(1);
    const pinchCenter = React.useRef(null);
    const lastTwoFingerPosition = React.useRef(null);
    const twoFingerPanMode = React.useRef(false);
    const isPanning = React.useRef(false);
    const lastPanPoint = React.useRef(null);
    const isSpacePressed = React.useRef(false);
    const wasDrawingMode = React.useRef(false); 
    const currentMode = React.useRef(mode);  
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

    const animate = () => {
        if (fabricCanvasRef.current) {
      
            const animateObjects = (objects) => {
                objects.forEach(obj => {
                    if (obj.type === 'group' && obj.getObjects) {
                       
                        animateObjects(obj.getObjects());
                    } else if (obj.animated) {
                   
                        obj.animationTime = (obj.animationTime || 0) + 0.5;
                        const settings = obj.animationSettings || {
                            pulseScale: 0.15,
                            rotationSpeed: 0.3,
                            opacityRange: 0.4,
                            moveAmplitude: 0.8,
                            skewAmount: 5
                        };

                        if (!obj.baseScaleX) obj.baseScaleX = obj.scaleX;
                        if (!obj.baseScaleY) obj.baseScaleY = obj.scaleY;

                        const pulseScale = 1 + Math.sin(obj.animationTime * 0.8) * settings.pulseScale;
                        if (obj.scaleX !== obj.baseScaleX * pulseScale) {
                            obj.baseScaleX = obj.scaleX / pulseScale;
                        }
                        if (obj.scaleY !== obj.baseScaleY * pulseScale) {
                            obj.baseScaleY = obj.scaleY / pulseScale;
                        }
                        obj.scaleX = obj.baseScaleX * pulseScale;
                        obj.scaleY = obj.baseScaleY * pulseScale;

                        obj.angle += Math.sin(obj.animationTime * settings.rotationSpeed) * 2;
                        obj.opacity = settings.opacityRange > 0 ? 
                            1 + Math.sin(obj.animationTime * 0.4) * settings.opacityRange :
                            1;

                        obj.left += Math.sin(obj.animationTime * 0.3) * settings.moveAmplitude;
                        obj.top += Math.cos(obj.animationTime * 0.2) * settings.moveAmplitude;

                        obj.skewX = Math.sin(obj.animationTime * 0.25) * settings.skewAmount;
                        obj.skewY = Math.cos(obj.animationTime * 0.25) * settings.skewAmount;
                    }
                });
            };

            animateObjects(fabricCanvasRef.current.getObjects());
            fabricCanvasRef.current.renderAll();
            requestAnimationFrame(animate);
        }
    };

    React.useEffect(() => {
        currentMode.current = mode;
    }, [mode]);

    React.useEffect(() => {
        console.log('Initializing canvas');
        if (!fabricCanvasRef.current) {
            requestAnimationFrame(animate);

            isTouch.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            console.log('Is touch device:', isTouch.current);

            // canvas
            const fixedWidth = isTouch.current ? 1000 : 2000;
            const fixedHeight = isTouch.current ? 1000 : 2000;
            console.log('Canvas size:', fixedWidth, 'x', fixedHeight);

            fabricCanvasRef.current = new fabric.Canvas(canvasRef.current, {
                width: fixedWidth,
                height: fixedHeight,
                isDrawingMode: false,
                enableRetinaScaling: true,
                allowTouchScrolling: false,
                stopContextMenu: false,
                fireRightClick: false,
                fireMiddleClick: false,
                touchAction: 'none',
                devicePixelRatio: window.devicePixelRatio || 1,
                selection: true,
                preserveObjectStacking: true,
                imageSmoothingEnabled: false,
                renderOnAddRemove: true,
                skipTargetFind: false
            });
            setCanvas(fabricCanvasRef.current);

            const canvas = fabricCanvasRef.current;
            const canvasElement = canvas.upperCanvasEl;
            const lowerCanvasElement = canvas.lowerCanvasEl;
            
            [canvasElement, lowerCanvasElement].forEach(el => {
                if (el) {
                    el.style.touchAction = 'none';
                    el.style.msTouchAction = 'none'; 
                    el.style.webkitUserSelect = 'none';
                    el.style.userSelect = 'none';
                    el.style.webkitTransform = 'translate3d(0,0,0)';
                    el.style.transform = 'translate3d(0,0,0)';
                    el.style.webkitBackfaceVisibility = 'hidden';
                    el.style.backfaceVisibility = 'hidden';
                }
            });

            // desktop
            const handleWheel = (opt) => {
                const delta = opt.e.deltaY;
                let zoom = canvas.getZoom();
                zoom *= 0.999 ** delta;
                zoom = Math.min(Math.max(0.01, zoom), 20);
                canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
                opt.e.preventDefault();
                opt.e.stopPropagation();
            };

            const handleDirectMouseDown = (evt) => {
                console.log('DIRECT Mouse down event, isSpacePressed:', isSpacePressed.current, 'mode:', currentMode.current);

                if ((isSpacePressed.current || currentMode.current === 'pan') && !isTouch.current) {
                    console.log('DIRECT Starting pan mode, isSpace:', isSpacePressed.current, 'mode:', currentMode.current);
                    isPanning.current = true;
                    canvas.selection = false;
                    canvas.forEachObject(o => o.selectable = false);
                    lastPanPoint.current = { x: evt.clientX, y: evt.clientY };
                    canvas.setCursor('grabbing');
                    evt.preventDefault();
                    evt.stopPropagation();
                    return false;
                }
            };

            const handleDirectMouseMove = (evt) => {
                if (isPanning.current && lastPanPoint.current && !isTouch.current) {
                    console.log('DIRECT Panning...');
                    const deltaX = evt.clientX - lastPanPoint.current.x;
                    const deltaY = evt.clientY - lastPanPoint.current.y;

                    console.log('DIRECT Pan delta:', deltaX, deltaY);

                    canvas.relativePan({ x: deltaX, y: deltaY });

                    lastPanPoint.current = { x: evt.clientX, y: evt.clientY };
                    canvas.setCursor('grabbing');
                    evt.preventDefault();
                    evt.stopPropagation();
                }
            };

            const handleDirectMouseUp = (evt) => {
                if (isPanning.current && !isTouch.current) {
                    console.log('DIRECT Ending pan mode');
                    isPanning.current = false;

                    if (!isSpacePressed.current && currentMode.current !== 'pan') {
                        canvas.selection = true;
                        canvas.forEachObject(o => o.selectable = true);
                        canvas.setCursor('default');
                    } else {
                        canvas.setCursor('grab');
                    }
                    lastPanPoint.current = null;
                    evt.preventDefault();
                    evt.stopPropagation();
                }
            };

            // для других режимов
            const handleMouseDown = (opt) => {
                const evt = opt.e;
                console.log('Fabric Mouse down event, isSpacePressed:', isSpacePressed.current, 'mode:', currentMode.current);

                
                if ((isSpacePressed.current || currentMode.current === 'pan') && !isTouch.current) {
                    return; 
                }

                if (!isTouch.current && ((evt.button === 1) || (evt.button === 0 && (evt.shiftKey || evt.altKey)))) {
                    isPanning.current = true;
                    canvas.selection = false;
                    canvas.forEachObject(o => o.selectable = false);
                    lastPanPoint.current = { x: evt.clientX, y: evt.clientY };
                    canvas.setCursor('grab');
                    opt.e.preventDefault();
                }
            };

            const handleMouseMove = (opt) => {
                
                if ((isSpacePressed.current || currentMode.current === 'pan')) {
                    return;
                }

                if (isPanning.current && lastPanPoint.current && !isTouch.current) {
                    const evt = opt.e;
                    const deltaX = evt.clientX - lastPanPoint.current.x;
                    const deltaY = evt.clientY - lastPanPoint.current.y;

                    canvas.relativePan({ x: deltaX, y: deltaY });

                    lastPanPoint.current = { x: evt.clientX, y: evt.clientY };
                    canvas.setCursor('grabbing');
                }
            };

            const handleMouseUp = (opt) => {
                
                if ((isSpacePressed.current || currentMode.current === 'pan')) {
                    return;
                }

                if (isPanning.current && !isTouch.current) {
                    isPanning.current = false;
                    canvas.selection = true;
                    canvas.forEachObject(o => o.selectable = true);
                    canvas.setCursor('default');
                    lastPanPoint.current = null;
                }
            };

            const handleKeyDown = (e) => {
                if (!canvas) return;

                if (e.code === 'Space' && !e.repeat && !isSpacePressed.current) {
                    e.preventDefault();
                    isSpacePressed.current = true;

                    console.log('Space pressed, entering temporary pan mode');

                    wasDrawingMode.current = canvas.isDrawingMode;

                    canvas.isDrawingMode = false;
                    canvas.selection = false;
                    canvas.forEachObject(o => o.selectable = false);
                    canvas.defaultCursor = 'grab';
                    canvas.hoverCursor = 'grab';
                    canvas.setCursor('grab');
                    return;
                }

                if (e.code === 'KeyR' && !e.repeat) {
                    resetZoom();
                    return;
                }

                if (e.code === 'KeyF' && !e.repeat) {
                    fitToScreen();
                    return;
                }
            };

            const handleKeyUp = (e) => {
                if (!canvas) return;

                if (e.code === 'Space' && isSpacePressed.current) {
                    e.preventDefault();
                    isSpacePressed.current = false;

                    console.log('Space released, exiting temporary pan mode');

                    canvas.isDrawingMode = wasDrawingMode.current;

                    if (mode !== 'pan') {
                        canvas.selection = true;
                        canvas.forEachObject(o => o.selectable = true);
                        canvas.defaultCursor = 'default';
                        canvas.hoverCursor = 'move';
                        canvas.setCursor('default');
                    }
                }
            };

            const resetZoom = () => {
                canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
                canvas.zoomToPoint({ x: canvas.width / 2, y: canvas.height / 2 }, 1);
            };

            const fitToScreen = () => {
                const objects = canvas.getObjects();
                if (objects.length === 0) return;

                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

                objects.forEach(obj => {
                    const bound = obj.getBoundingRect();
                    minX = Math.min(minX, bound.left);
                    minY = Math.min(minY, bound.top);
                    maxX = Math.max(maxX, bound.left + bound.width);
                    maxY = Math.max(maxY, bound.top + bound.height);
                });

                const objectsWidth = maxX - minX;
                const objectsHeight = maxY - minY;

                const padding = 50;
                const zoomX = (canvas.width - padding * 2) / objectsWidth;
                const zoomY = (canvas.height - padding * 2) / objectsHeight;
                const zoom = Math.min(zoomX, zoomY, 5);

                const centerX = (minX + maxX) / 2;
                const centerY = (minY + maxY) / 2;

                canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
                canvas.zoomToPoint({ x: centerX, y: centerY }, zoom);

                const newCenter = canvas.getCenter();
                const viewportCenter = { x: canvas.width / 2, y: canvas.height / 2 };
                canvas.relativePan({
                    x: viewportCenter.x - newCenter.left,
                    y: viewportCenter.y - newCenter.top
                });
            };

            const updateZoomLevel = () => {
                setZoomLevel(canvas.getZoom());
            };

            const getDistance = (touch1, touch2) => {
                const dx = touch1.clientX - touch2.clientX;
                const dy = touch1.clientY - touch2.clientY;
                return Math.sqrt(dx * dx + dy * dy);
            };

            const getCenter = (touch1, touch2) => {
                return {
                    x: (touch1.clientX + touch2.clientX) / 2,
                    y: (touch1.clientY + touch2.clientY) / 2
                };
            };

            const handleTouchStart = (event) => {
                console.log('Touch start, mode:', currentMode.current, 'touches:', event.touches.length);
                
               
                if (event.touches.length === 2) {
                    console.log('Starting two-finger gesture');
                    event.preventDefault();
                    
                    if (canvas.isDrawingMode && canvas.freeDrawingBrush && canvas._isCurrentlyDrawing) {
                        canvas.freeDrawingBrush.onMouseUp();
                        canvas._isCurrentlyDrawing = false;
                    }
                    
                    const touch1 = event.touches[0];
                    const touch2 = event.touches[1];
                    
                    initialPinchDistance.current = getDistance(touch1, touch2);
                    lastZoom.current = canvas.getZoom();
                    pinchCenter.current = getCenter(touch1, touch2);
                    
                    lastTwoFingerPosition.current = getCenter(touch1, touch2);
                    twoFingerPanMode.current = false;
                    
                    const canvasRect = canvas.upperCanvasEl.getBoundingClientRect();
                    pinchCenter.current = {
                        x: pinchCenter.current.x - canvasRect.left,
                        y: pinchCenter.current.y - canvasRect.top
                    };
                    
                    return;
                }

                const touch = event.touches[0];
                touchStartPos.current = { x: touch.clientX, y: touch.clientY };
                touchMoved.current = false;

                if (currentMode.current === 'brush') {
                    console.log('Brush mode - iOS touch handling');
                    if (canvas.isDrawingMode && canvas.freeDrawingBrush && !initialPinchDistance.current && !twoFingerPanMode.current) {
                        const pointer = canvas.getPointer(touch);
                        canvas.freeDrawingBrush.onMouseDown(pointer);
                        canvas._isCurrentlyDrawing = true;
                        // Хаптическая обратная связь при начале рисования
                        triggerHaptic('impact', 'light');
                    }
                    return;
                }

                if (currentMode.current === 'text') {
                    console.log('Adding text on touch');
                    event.preventDefault();
                    const pointer = canvas.getPointer(event.touches[0]);
                    triggerHaptic('impact', 'light');
                    addTextAtPosition(pointer);
                    return;
                }

                if (currentMode.current === 'select') {
                    longPressTimer.current = setTimeout(() => {
                        if (!touchMoved.current) {
                            const rect = canvas.upperCanvasEl.getBoundingClientRect();
                            const simulatedEvent = {
                                clientX: touch.clientX,
                                clientY: touch.clientY,
                                offsetX: touch.clientX - rect.left,
                                offsetY: touch.clientY - rect.top
                            };
                            showContextMenu(simulatedEvent);
                        }
                    }, longPressDelay);
                }
            };

            const handleTouchMove = (event) => {
               
                if (event.touches.length === 2 && initialPinchDistance.current !== null) {
                    event.preventDefault();
                    
                    const touch1 = event.touches[0];
                    const touch2 = event.touches[1];
                    
                    const currentDistance = getDistance(touch1, touch2);
                    const currentCenter = getCenter(touch1, touch2);
                    
                    const distanceChange = Math.abs(currentDistance - initialPinchDistance.current);
                    const centerMovement = Math.sqrt(
                        Math.pow(currentCenter.x - lastTwoFingerPosition.current.x, 2) +
                        Math.pow(currentCenter.y - lastTwoFingerPosition.current.y, 2)
                    );
                    
                    if (distanceChange > 1) { 
                        const scale = currentDistance / initialPinchDistance.current;
                        let newZoom = lastZoom.current * scale;
                        
                        newZoom = Math.min(Math.max(0.1, newZoom), 10);
                        
                        canvas.zoomToPoint(pinchCenter.current, newZoom);
                        
                        console.log('Simultaneous zoom:', newZoom);
                    }
                    
                    if (centerMovement > 1) { 
                        const deltaX = currentCenter.x - lastTwoFingerPosition.current.x;
                        const deltaY = currentCenter.y - lastTwoFingerPosition.current.y;
                        
                        
                        canvas.relativePan({ x: deltaX, y: deltaY });
                        console.log('Simultaneous pan:', deltaX, deltaY);
                    }
                    
    
                    lastTwoFingerPosition.current = currentCenter; 
                    return;
                }

                if (currentMode.current === 'brush' && event.touches.length === 1) {
                    if (canvas.isDrawingMode && canvas.freeDrawingBrush && canvas._isCurrentlyDrawing && !initialPinchDistance.current && !twoFingerPanMode.current) {
                        const touch = event.touches[0];
                        const pointer = canvas.getPointer(touch);
                        canvas.freeDrawingBrush.onMouseMove(pointer);
                        canvas.renderAll();
                    }
                    return;
                }

                if (event.touches.length === 1) {
                    const touch = event.touches[0];

                    if (touchStartPos.current) {
                        const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
                        const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);

                        if (deltaX > 10 || deltaY > 10) {
                            touchMoved.current = true;
                            if (longPressTimer.current) {
                                clearTimeout(longPressTimer.current);
                                longPressTimer.current = null;
                            }
                        }
                    }
                }
            };

            const handleTouchEnd = (event) => {
                console.log('Touch end, mode:', currentMode.current, 'remaining touches:', event.touches.length);

                if (event.touches.length < 2) {
                    initialPinchDistance.current = null;
                    lastZoom.current = 1;
                    pinchCenter.current = null;
                    lastTwoFingerPosition.current = null;
                    twoFingerPanMode.current = false;
                }

                if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                }

                if (currentMode.current === 'brush' && event.touches.length === 0) {
                    if (canvas.isDrawingMode && canvas.freeDrawingBrush && canvas._isCurrentlyDrawing && !initialPinchDistance.current && !twoFingerPanMode.current) {
                        canvas.freeDrawingBrush.onMouseUp();
                        canvas._isCurrentlyDrawing = false;
                        canvas.renderAll();
                    }
                    else if (initialPinchDistance.current || twoFingerPanMode.current) {
                        canvas._isCurrentlyDrawing = false;
                    }
                    return;
                }

                if (event.touches.length === 0) {
                    touchStartPos.current = null;
                    touchMoved.current = false;
                }
            };

            canvasElement.addEventListener('mousedown', handleDirectMouseDown, true);
            canvasElement.addEventListener('mousemove', handleDirectMouseMove, true);
            canvasElement.addEventListener('mouseup', handleDirectMouseUp, true);
            canvas.on('mouse:wheel', handleWheel);
            canvas.on('mouse:down', handleMouseDown);
            canvas.on('mouse:move', handleMouseMove);
            canvas.on('mouse:up', handleMouseUp);
            canvas.on('after:render', updateZoomLevel);
            document.addEventListener('keydown', handleKeyDown);
            document.addEventListener('keyup', handleKeyUp);

            if (isTouch.current) {
                console.log('Setting up touch handlers for iOS');

                canvas.upperCanvasEl.addEventListener('contextmenu', (e) => {
                    if (currentMode.current === 'brush') {
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    }
                    handleContextMenu(e);
                });

                canvas.upperCanvasEl.addEventListener('touchstart', handleTouchStart, { passive: false });
                canvas.upperCanvasEl.addEventListener('touchmove', handleTouchMove, { passive: false });
                canvas.upperCanvasEl.addEventListener('touchend', handleTouchEnd, { passive: false });
                
                canvas.upperCanvasEl.addEventListener('touchcancel', handleTouchEnd, { passive: false });
            } else {
                canvas.upperCanvasEl.addEventListener('contextmenu', handleContextMenu);
            }

            document.addEventListener('paste', handlePasteEvent);
            document.addEventListener('click', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);

            const canvasContainer = document.getElementById('canvas-container');
            if (canvasContainer) {
                canvasContainer.addEventListener('click', handleCanvasClick);
                canvasContainer.addEventListener('touchstart', handleCanvasClick);
            }

            if (isTouch.current) {
                setTimeout(() => {
                    canvas.calcOffset();
                    canvas.renderAll();
                }, 100);
            }

            return () => {
                console.log('Disposing canvas');

                canvasElement.removeEventListener('mousedown', handleDirectMouseDown, true);
                canvasElement.removeEventListener('mousemove', handleDirectMouseMove, true);
                canvasElement.removeEventListener('mouseup', handleDirectMouseUp, true);
                canvas.off('mouse:wheel', handleWheel);
                canvas.off('mouse:down', handleMouseDown);
                canvas.off('mouse:move', handleMouseMove);
                canvas.off('mouse:up', handleMouseUp);
                canvas.off('after:render', updateZoomLevel);
                document.removeEventListener('keydown', handleKeyDown);
                document.removeEventListener('keyup', handleKeyUp);

                canvas.upperCanvasEl.removeEventListener('contextmenu', handleContextMenu);
                if (isTouch.current) {
                    canvas.upperCanvasEl.removeEventListener('touchstart', handleTouchStart);
                    canvas.upperCanvasEl.removeEventListener('touchmove', handleTouchMove);
                    canvas.upperCanvasEl.removeEventListener('touchend', handleTouchEnd);
                }
                document.removeEventListener('paste', handlePasteEvent);
                document.removeEventListener('click', handleClickOutside);
                document.removeEventListener('touchstart', handleClickOutside);

                if (canvasContainer) {
                    canvasContainer.removeEventListener('click', handleCanvasClick);
                    canvasContainer.removeEventListener('touchstart', handleCanvasClick);
                }

                canvas.dispose();
            };
        }
    }, [setCanvas]);

    const addTextAtPosition = (pointer) => {
        console.log('Adding text at position:', pointer);
        const canvas = fabricCanvasRef.current;
        const text = new fabric.IText('alfatapes', {
            left: pointer.x,
            top: pointer.y,
            fontSize: 20,
            fill: color,
            fontFamily: 'Arial',
            editable: true,
            selectable: true
        });

        canvas.add(text);
        canvas.setActiveObject(text);

        if (setMode) {
            setMode('select');
            setTimeout(() => {
                text.enterEditing();
                canvas.renderAll();
            }, 100);
        }
    };

    const addText = (e) => {
        if (mode === 'text' && fabricCanvasRef.current) {
            const pointer = fabricCanvasRef.current.getPointer(e);
            addTextAtPosition(pointer);
        }
    };

    React.useEffect(() => {
        console.log('Updating canvas properties for mode:', mode);
        const canvas = fabricCanvasRef.current;
        if (canvas) {
            canvas.off('mouse:down');
            canvas.isDrawingMode = false;

            if (mode === 'text') {
                if (!isTouch.current) {
                    canvas.on('mouse:down', addText);
                }
                canvas.selection = true;
                canvas.forEachObject(o => o.selectable = true);
                canvas.defaultCursor = 'text';
                canvas.hoverCursor = 'text';
            } else if (mode === 'brush') {
                console.log('Setting brush mode');
                canvas.isDrawingMode = true;
                const brush = new fabric.CrayonBrush(canvas);
                brush.color = color;
                brush.width = brushSize;
                brush.opacity = opacity;
                brush.textureScale = textureScale;
                brush.strokeVariation = strokeVariation;
                brush.pressureVariation = pressureVariation;
                brush.graininess = graininess;
                brush.strokeCount = strokeCount;
                brush.grainSize = grainSize;
                brush.animated = true;
                brush.animationSettings = {
                    pulseScale: 0,
                    rotationSpeed: 0,
                    moveAmplitude: 0.2,
                    opacityRange: 0,
                    skewAmount: 2
                };

                if (canvas.freeDrawingBrush) {
                    brush.animated = canvas.freeDrawingBrush.animated;
                    brush.animationSettings = canvas.freeDrawingBrush.animationSettings || brush.animationSettings;
                }

                canvas.freeDrawingBrush = brush;
                canvas.selection = false;
                canvas.forEachObject(o => o.selectable = false);
                
                if (isTouch.current) {
                    console.log('Configuring brush for iOS');
                    canvas._isCurrentlyDrawing = false;
                    
                    setTimeout(() => {
                        canvas.calcOffset();
                        canvas.renderAll();
                    }, 50);
                }
                
                console.log('Brush set:', brush);
            } else if (mode === 'pan') {
                console.log('Setting pan mode');
                canvas.selection = false;
                canvas.forEachObject(o => o.selectable = false);
                canvas.defaultCursor = 'grab';
                canvas.hoverCursor = 'grab';
                canvas.setCursor('grab');
            } else {
                console.log('Setting select mode');
                canvas.selection = true;
                canvas.forEachObject(o => o.selectable = true);
                canvas.defaultCursor = 'default';
                canvas.hoverCursor = 'move';
            }
            canvas.renderAll();
        }
    }, [mode, color, brushSize, opacity, textureScale, strokeVariation, pressureVariation, graininess, strokeCount, grainSize]);

    const handleContextMenu = (event) => {
        event.preventDefault();
        if (mode === 'select') {
            showContextMenu(event);
        }
    };

    const showContextMenu = (event) => {
        const canvas = fabricCanvasRef.current;
        const pointer = canvas.getPointer(event);
        const target = canvas.findTarget(event);
        if (target) {
            canvas.setActiveObject(target);
            canvas.renderAll();
        }

        const screenX = event.clientX || event.offsetX;
        const screenY = event.clientY || event.offsetY;

        setContextMenu({
            x: screenX,
            y: screenY,
            target: target
        });
    };

    const handleCloseContextMenu = () => {
        setContextMenu(null);
    };

    const handleClickOutside = (event) => {
        const menuElement = document.getElementById('context-menu');
        if (menuElement && !menuElement.contains(event.target)) {
            handleCloseContextMenu();
        }
    };

    const handleCanvasClick = (event) => {
        const menuElement = document.getElementById('context-menu');
        if (contextMenu && (!menuElement || !menuElement.contains(event.target))) {
            handleCloseContextMenu();
        }
    };

    const handleDeleteObject = () => {
        const canvas = fabricCanvasRef.current;
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
            if (activeObject.type === 'activeSelection') {
                activeObject.forEachObject((obj) => {
                    canvas.remove(obj);
                });
                canvas.discardActiveObject();
            } else {
                canvas.remove(activeObject);
            }
            canvas.requestRenderAll();
        }
        handleCloseContextMenu();
    };

    const handleFlipHorizontally = () => {
        if (contextMenu && contextMenu.target) {
            flipHorizontally();
            handleCloseContextMenu();
        }
    };

    const handleDuplicate = () => {
        const activeObject = fabricCanvasRef.current.getActiveObject();
        if (activeObject) {
            const newLeft = activeObject.left + 10;
            const newTop = activeObject.top + 10;

            activeObject.clone((clonedObj) => {
                if (clonedObj.type === 'activeSelection') {
                    clonedObj.canvas = fabricCanvasRef.current;
                    clonedObj.forEachObject((obj, index) => {
                        const originalObj = activeObject.getObjects()[index];
                        if (originalObj && originalObj.animated) {
                            obj.animated = true;
                            obj.animationSettings = originalObj.animationSettings ? 
                                {...originalObj.animationSettings} : {
                                    pulseScale: 0.15,
                                    rotationSpeed: 0.3,
                                    opacityRange: 0.4,
                                    moveAmplitude: 0.8,
                                    skewAmount: 5
                                };
                            obj.animationTime = Math.random() * 100;
                            obj.originalLeft = obj.left + 10;
                            obj.originalTop = obj.top + 10;
                        }
                        fabricCanvasRef.current.add(obj);
                    });
                } else {
                    fabricCanvasRef.current.add(clonedObj);

                    if (activeObject.animated) {
                        clonedObj.animated = true;
                        clonedObj.animationSettings = JSON.parse(JSON.stringify(activeObject.animationSettings));
                        clonedObj.animationTime = Math.random() * 100;
                        clonedObj.originalLeft = newLeft;
                        clonedObj.originalTop = newTop;
                    }
                }

                clonedObj.set({
                    left: newLeft,
                    top: newTop,
                    evented: true
                });

                clonedObj.setCoords();
                fabricCanvasRef.current.setActiveObject(clonedObj);
                fabricCanvasRef.current.requestRenderAll();
            });
        }
        handleCloseContextMenu();
    };

    const handlePasteEvent = (event) => {
        event.preventDefault();
        handlePaste(event.clipboardData);
    };

    const handlePaste = (clipboardData) => {
        if (!clipboardData) {
            navigator.clipboard.read().then(clipboardItems => {
                for (const clipboardItem of clipboardItems) {
                    for (const type of clipboardItem.types) {
                        if (type.startsWith('image/')) {
                            clipboardItem.getType(type).then(blob => {
                                const reader = new FileReader();
                                reader.onload = (e) => {
                                    createImageOnCanvas(e.target.result);
                                };
                                reader.readAsDataURL(blob);
                            });
                        }
                    }
                }
            }).catch(err => {
                console.error('Failed to read clipboard contents: ', err);
            });
        } else {
            const items = clipboardData.items;
            for (let index in items) {
                const item = items[index];
                if (item.kind === 'file') {
                    const blob = item.getAsFile();
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        createImageOnCanvas(e.target.result);
                    };
                    reader.readAsDataURL(blob);
                }
            }
        }
        handleCloseContextMenu();
    };

    const createImageOnCanvas = (src) => {
        const img = new Image();
        img.onload = () => {
            const canvas = fabricCanvasRef.current;
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;

            const maxDimension = Math.min(canvasWidth, canvasHeight) * 0.2;

            let newWidth, newHeight;
            if (img.width > img.height) {
                newWidth = maxDimension;
                newHeight = (img.height / img.width) * maxDimension;
            } else {
                newHeight = maxDimension;
                newWidth = (img.width / img.height) * maxDimension;
            }

            const fabricImage = new fabric.Image(img, {
                left: (canvasWidth - newWidth) / 2,
                top: (canvasHeight - newHeight) / 2,
                scaleX: newWidth / img.width,
                scaleY: newHeight / img.height,
            });

            canvas.add(fabricImage);
            canvas.setActiveObject(fabricImage);
            canvas.renderAll();
        };
        img.src = src;
    };

    return (
        <div id="canvas-container">
            <canvas ref={canvasRef} />
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={handleCloseContextMenu}
                    onDelete={handleDeleteObject}
                    onFlipHorizontally={handleFlipHorizontally}
                    onDuplicate={handleDuplicate}
                    onPaste={handlePaste}
                    hasTarget={!!contextMenu.target}
                    fabricCanvas={fabricCanvasRef.current}
                />
            )}
        </div>
    );
};

const ContextMenu = ({ x, y, onClose, onDelete, onFlipHorizontally, onDuplicate, onPaste, hasTarget, fabricCanvas }) => {
    const menuRef = React.useRef(null);
    const activeObject = fabricCanvas.getActiveObject();
    const [showAnimationControls, setShowAnimationControls] = React.useState(activeObject?.animated || false);

    React.useEffect(() => {
        if (activeObject) {
            setShowAnimationControls(activeObject.animated || false);
        }
    }, [activeObject]);

    const [animationSettings, setAnimationSettings] = React.useState({
        pulseScale: 0,
        rotationSpeed: 0,
        opacityRange: 0,
        moveAmplitude: 0.2,
        skewAmount: 2
    });

    React.useEffect(() => {
        if (activeObject?.animated && activeObject?.animationSettings) {
            setAnimationSettings({ ...activeObject.animationSettings });
        }
    }, [activeObject]);

    const toggleAnimation = (show) => {
        const activeObject = fabricCanvas.getActiveObject();
        if (activeObject) {
            activeObject.animated = show;
            if (show) {
                if (!activeObject.originalLeft) activeObject.originalLeft = activeObject.left;
                if (!activeObject.originalTop) activeObject.originalTop = activeObject.top;
                if (!activeObject.baseScaleX) activeObject.baseScaleX = activeObject.scaleX;
                if (!activeObject.baseScaleY) activeObject.baseScaleY = activeObject.scaleY;
                activeObject.animationSettings = {...animationSettings};
                activeObject.animationTime = 0;
            } else {
                const currentLeft = activeObject.left;
                const currentTop = activeObject.top;

                activeObject.scaleX = 1;
                activeObject.scaleY = 1;
                activeObject.angle = 0;
                activeObject.opacity = 1;
                activeObject.skewX = 0;
                activeObject.skewY = 0;

                activeObject.left = currentLeft;
                activeObject.top = currentTop;
                activeObject.originalLeft = currentLeft;
                activeObject.originalTop = currentTop;
            }
            fabricCanvas.renderAll();
        }
    };

    const updateAnimationSettings = (key, value) => {
        const newValue = parseFloat(value);
        setAnimationSettings(prev => {
            const newSettings = {
                ...prev,
                [key]: newValue
            };

            const activeObject = fabricCanvas.getActiveObject();
            if (activeObject && activeObject.animated) {
                activeObject.animationSettings = {...newSettings};
            }

            return newSettings;
        });
    };

    return (
        <div id="context-menu" ref={menuRef} style={{
            left: `${x}px`,
            top: `${y}px`,
        }}>
            {hasTarget && (
                <div>
                    <button onClick={() => { onDelete(); onClose(); }}>Delete</button>
                    <button onClick={() => { onFlipHorizontally(); onClose(); }}>Flip Horizontally</button>
                    <button onClick={() => { onDuplicate(); onClose(); }}>Duplicate</button>
                    <button onClick={() => { 
                        const newState = !showAnimationControls;
                        setShowAnimationControls(newState);
                        toggleAnimation(newState);
                    }}>
                        {showAnimationControls ? 'stop' : 'play'}
                    </button>

                    {showAnimationControls && (
                        <div className="animation-controls">
                            <label>
                                Pulse Scale
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="1" 
                                    step="0.01"
                                    value={animationSettings.pulseScale}
                                    onChange={(e) => updateAnimationSettings('pulseScale', e.target.value)}
                                />
                            </label>
                            <label>
                                Rotation Speed
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="1" 
                                    step="0.01"
                                    value={animationSettings.rotationSpeed}
                                    onChange={(e) => updateAnimationSettings('rotationSpeed', e.target.value)}
                                />
                            </label>
                            <label>
                                Opacity Range
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="1" 
                                    step="0.01"
                                    value={animationSettings.opacityRange}
                                    onChange={(e) => updateAnimationSettings('opacityRange', e.target.value)}
                                />
                            </label>
                            <label>
                                Move Amplitude
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="2" 
                                    step="0.01"
                                    value={animationSettings.moveAmplitude}
                                    onChange={(e) => updateAnimationSettings('moveAmplitude', e.target.value)}
                                />
                            </label>
                            <label>
                                Skew Amount
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="10" 
                                    step="0.1"
                                    value={animationSettings.skewAmount}
                                    onChange={(e) => updateAnimationSettings('skewAmount', e.target.value)}
                                />
                            </label>
                        </div>
                    )}
                </div>
            )}
            <button onClick={() => {
                if (navigator.clipboard && navigator.clipboard.read) {
                    onPaste();
                } else {
                    const input = document.createElement('input');
                    input.setAttribute('type', 'file');
                    input.setAttribute('accept', 'image/*');
                    input.onchange = (event) => {
                        const file = event.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                createImageOnCanvas(e.target.result);
                            };
                            reader.readAsDataURL(file);
                        }
                    };
                    input.click();
                }
                onClose();
            }}>Paste</button>
        </div>
    );
};



if (typeof window !== 'undefined') {
    window.Canvas = Canvas;
} else if (typeof global !== 'undefined') {
    global.Canvas = Canvas;
} else if (typeof globalThis !== 'undefined') {
    globalThis.Canvas = Canvas;
} else {
    console.error('Unable to find global object to attach Canvas');
}

console.log('Canvas.js has finished loading');