console.log('Loading LayersPanel component...');

const LayersPanel = ({ canvas, isVisible, onClose }) => {
    const [layers, setLayers] = React.useState([]);
    const [selectedLayers, setSelectedLayers] = React.useState([]);
    const [expandedGroups, setExpandedGroups] = React.useState(new Set());

    // Функция для создания иерархической структуры слоев
    const buildLayerHierarchy = (objects) => {
        const layerData = [];

        // Подсчитываем количество объектов каждого типа для правильной нумерации ТОЛЬКО для новых объектов
        const typeCounts = {};

        // Первый проход - определяем максимальные номера для каждого типа
        objects.forEach(obj => {
            if (obj.layerName) {
                const match = obj.layerName.match(/^(img|txt|gp|lr)\s+(\d+)$/);
                if (match) {
                    const typeKey = match[1];
                    const number = parseInt(match[2]);
                    typeCounts[typeKey] = Math.max(typeCounts[typeKey] || 0, number);
                }
            }
        });

        // Второй проход - присваиваем имена только тем объектам, у которых их нет
        objects.forEach(obj => {
            if (!obj.layerName) {
                const typeKey = obj.type === 'image' ? 'img' 
                    : obj.type === 'text' || obj.type === 'i-text' || obj.type === 'textbox' ? 'txt'
                    : obj.type === 'group' ? 'gp' 
                    : 'lr';

                typeCounts[typeKey] = (typeCounts[typeKey] || 0) + 1;
                obj.layerName = `${typeKey} ${typeCounts[typeKey]}`;
            }
        });

        objects.forEach((obj, index) => {
            // Используем существующее имя объекта (НЕ пересчитываем)
            let layerName = obj.layerName;

            const layer = {
                id: obj.id || `layer_${index}`,
                name: layerName,
                type: obj.type,
                visible: obj.visible !== false,
                locked: obj.selectable === false,
                index: index,
                object: obj,
                isGroup: obj.type === 'group',
                level: 0,
                children: []
            };

            // Если это группа, добавляем её дочерние элементы
            if (obj.type === 'group' && obj.getObjects) {
                const groupObjects = obj.getObjects();

                // Подсчитываем типы в группе для правильной нумерации
                const groupTypeCounts = {};
                groupObjects.forEach(childObj => {
                    if (!childObj.layerName) {
                        const typeKey = childObj.type === 'image' ? 'img' 
                            : childObj.type === 'text' || childObj.type === 'i-text' || childObj.type === 'textbox' ? 'txt'
                            : childObj.type === 'group' ? 'gp' 
                            : 'lr';

                        groupTypeCounts[typeKey] = (groupTypeCounts[typeKey] || 0) + 1;
                        childObj.layerName = `${typeKey} ${groupTypeCounts[typeKey]}`;
                    }
                });

                layer.children = groupObjects.map((childObj, childIndex) => {
                    let childLayerName = childObj.layerName;
                    if (!childLayerName) {
                        if (childObj.type === 'image') {
                            childLayerName = `img ${childIndex + 1}`;
                        } else if (childObj.type === 'text' || childObj.type === 'i-text' || childObj.type === 'textbox') {
                            childLayerName = `txt ${childIndex + 1}`;
                        } else if (childObj.type === 'group') {
                            childLayerName = `gp ${childIndex + 1}`;
                        } else {
                            childLayerName = `lr ${childIndex + 1}`;
                        }
                        childObj.layerName = childLayerName;
                    }

                    return {
                        id: childObj.id || `child_${index}_${childIndex}`,
                        name: childLayerName,
                        type: childObj.type,
                        visible: childObj.visible !== false,
                        locked: childObj.selectable === false,
                        index: childIndex,
                        object: childObj,
                        parent: obj,
                        parentId: layer.id,
                        isGroup: false,
                        level: 1,
                        children: []
                    }
                });
            }

            layerData.push(layer);
        });

        return layerData.reverse();
    };

    // Функция для превращения иерархии в плоский список для отображения
    const flattenLayers = (hierarchy) => {
        const result = [];

        hierarchy.forEach(layer => {
            result.push(layer);

            if (layer.isGroup && expandedGroups.has(layer.id) && layer.children.length > 0) {
                layer.children.forEach(child => {
                    result.push(child);
                });
            }
        });

        return result;
    };

    // Синхронизация выделения с canvas
    const syncSelectionFromCanvas = React.useCallback(() => {
        if (!canvas) return;

        const activeObject = canvas.getActiveObject();
        if (!activeObject) {
            setSelectedLayers([]);
            return;
        }

        if (activeObject.type === 'activeSelection') {
            // Множественное выделение
            const objects = activeObject.getObjects();
            const ids = objects.map(obj => obj.id).filter(Boolean);
            setSelectedLayers(ids);
        } else {
            // Одиночное выделение
            if (activeObject.id) {
                setSelectedLayers([activeObject.id]);
            }
        }
    }, [canvas]);

    // Обновляем список слоев при изменении canvas
    React.useEffect(() => {
        if (!canvas) return;

        const updateLayers = () => {
            const objects = canvas.getObjects();
            const hierarchy = buildLayerHierarchy(objects);
            const flatLayers = flattenLayers(hierarchy);
            setLayers(flatLayers);
        };

        updateLayers();

        // Подписываемся на события canvas
        canvas.on('object:added', updateLayers);
        canvas.on('object:removed', updateLayers);
        canvas.on('object:modified', updateLayers);
        canvas.on('selection:created', syncSelectionFromCanvas);
        canvas.on('selection:updated', syncSelectionFromCanvas);
        canvas.on('selection:cleared', () => setSelectedLayers([]));

        return () => {
            canvas.off('object:added', updateLayers);
            canvas.off('object:removed', updateLayers);
            canvas.off('object:modified', updateLayers);
            canvas.off('selection:created', syncSelectionFromCanvas);
            canvas.off('selection:updated', syncSelectionFromCanvas);
            canvas.off('selection:cleared', () => setSelectedLayers([]));
        };
    }, [canvas, expandedGroups, syncSelectionFromCanvas]);

    // Переключение разворачивания группы
    const toggleGroupExpanded = (groupId) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(groupId)) {
                newSet.delete(groupId);
            } else {
                newSet.add(groupId);
            }
            return newSet;
        });
    };

    // Перемещение слоя вверх
    const moveLayerUp = (layer) => {
        if (!canvas) return;

        if (layer.parent) {
            const group = layer.parent;
            const groupIndex = canvas.getObjects().indexOf(group);
            if (groupIndex < canvas.getObjects().length - 1) {
                canvas.bringForward(group);
                canvas.renderAll();
                // Принудительно обновляем список слоев
                setTimeout(() => {
                    const objects = canvas.getObjects();
                    const hierarchy = buildLayerHierarchy(objects);
                    const flatLayers = flattenLayers(hierarchy);
                    setLayers(flatLayers);
                }, 50);
            }
        } else {
            const index = canvas.getObjects().indexOf(layer.object);
            if (index < canvas.getObjects().length - 1) {
                canvas.bringForward(layer.object);
                canvas.renderAll();
                // Принудительно обновляем список слоев
                setTimeout(() => {
                    const objects = canvas.getObjects();
                    const hierarchy = buildLayerHierarchy(objects);
                    const flatLayers = flattenLayers(hierarchy);
                    setLayers(flatLayers);
                }, 50);
            }
        }
    };

    // Перемещение слоя вниз
    const moveLayerDown = (layer) => {
        if (!canvas) return;

        if (layer.parent) {
            const group = layer.parent;
            const groupIndex = canvas.getObjects().indexOf(group);
            if (groupIndex > 0) {
                canvas.sendBackwards(group);
                canvas.renderAll();
                // Принудительно обновляем список слоев
                setTimeout(() => {
                    const objects = canvas.getObjects();
                    const hierarchy = buildLayerHierarchy(objects);
                    const flatLayers = flattenLayers(hierarchy);
                    setLayers(flatLayers);
                }, 50);
            }
        } else {
            const index = canvas.getObjects().indexOf(layer.object);
            if (index > 0) {
                canvas.sendBackwards(layer.object);
                canvas.renderAll();
                // Принудительно обновляем список слоев
                setTimeout(() => {
                    const objects = canvas.getObjects();
                    const hierarchy = buildLayerHierarchy(objects);
                    const flatLayers = flattenLayers(hierarchy);
                    setLayers(flatLayers);
                }, 50);
            }
        }
    };

    // Переключение видимости слоя
    const toggleLayerVisibility = (layer) => {
        if (!canvas) return;

        const targetObject = layer.parent || layer.object;
        targetObject.visible = !targetObject.visible;
        canvas.renderAll();

        // Обновляем состояние слоя в списке
        setLayers(prevLayers => 
            prevLayers.map(l => 
                l.id === layer.id 
                    ? { ...l, visible: targetObject.visible }
                    : l
            )
        );
    };

    // Переключение блокировки слоя
    const toggleLayerLock = (layer) => {
        if (!canvas) return;

        const targetObject = layer.parent || layer.object;
        targetObject.selectable = !targetObject.selectable;
        targetObject.evented = targetObject.selectable;
        canvas.renderAll();

        // Обновляем состояние слоя в списке
        setLayers(prevLayers => 
            prevLayers.map(l => 
                l.id === layer.id 
                    ? { ...l, locked: !targetObject.selectable }
                    : l
            )
        );
    };

    // ИСПРАВЛЕННЫЙ выбор слоя
    const selectLayer = (layer, isMultiple = false) => {
        if (!canvas) return;

        const targetObject = layer.parent || layer.object;

        if (isMultiple) {
            const newSelection = selectedLayers.includes(layer.id) 
                ? selectedLayers.filter(id => id !== layer.id)
                : [...selectedLayers, layer.id];
            setSelectedLayers(newSelection);

            const objectsToSelect = layers
                .filter(l => newSelection.includes(l.id))
                .map(l => l.parent || l.object)
                .filter((obj, index, self) => self.indexOf(obj) === index);

            if (objectsToSelect.length > 1) {
                // ПРАВИЛЬНЫЙ способ создания множественного выделения
                canvas.discardActiveObject();

                // Создаем ActiveSelection без изменения координат объектов
                const selection = new fabric.ActiveSelection(objectsToSelect, {
                    canvas: canvas
                });
                canvas.setActiveObject(selection);
            } else if (objectsToSelect.length === 1) {
                canvas.setActiveObject(objectsToSelect[0]);
            } else {
                canvas.discardActiveObject();
            }
        } else {
            setSelectedLayers([layer.id]);
            canvas.setActiveObject(targetObject);
        }

        canvas.renderAll();
    };

    // Удаление слоя
    const deleteLayer = (layer) => {
        if (!canvas) return;

        const targetObject = layer.parent || layer.object;
        canvas.remove(targetObject);
        canvas.renderAll();
    };

    // ПОЛНОСТЬЮ ИСПРАВЛЕННАЯ функция группировки с сохранением анимации
    const createGroup = () => {
        if (!canvas || selectedLayers.length < 2) return;

        console.log('Creating group from selected layers:', selectedLayers);

        // Получаем объекты для группировки
        const objectsToGroup = layers
            .filter(l => selectedLayers.includes(l.id) && !l.parent)
            .map(l => l.object);

        console.log('Objects to group:', objectsToGroup);

        if (objectsToGroup.length < 2) {
            alert('Выберите минимум 2 независимых объекта для группировки');
            return;
        }

        // Сохраняем состояние каждого объекта перед группировкой, включая анимационные свойства
        const objectsState = objectsToGroup.map(obj => {
            console.log(`Object ${obj.type}:`, {
                left: obj.left,
                top: obj.top,
                width: obj.width,
                height: obj.height,
                scaleX: obj.scaleX,
                scaleY: obj.scaleY,
                angle: obj.angle,
                visible: obj.visible,
                opacity: obj.opacity,
                animated: obj.animated,
                animationTime: obj.animationTime,
                animationSettings: obj.animationSettings
            });

            return {
                object: obj,
                left: obj.left,
                top: obj.top,
                scaleX: obj.scaleX,
                scaleY: obj.scaleY,
                angle: obj.angle,
                visible: obj.visible,
                opacity: obj.opacity,
                // НОВОЕ: сохраняем анимационные свойства
                animated: obj.animated,
                animationTime: obj.animationTime,
                animationSettings: obj.animationSettings ? {...obj.animationSettings} : null,
                baseScaleX: obj.baseScaleX,
                baseScaleY: obj.baseScaleY,
                originalLeft: obj.originalLeft,
                originalTop: obj.originalTop
            };
        });

        // Создаем группу с правильными параметрами
        try {
            // Сначала убираем все выделения
            canvas.discardActiveObject();

            // Создаем группу напрямую
            const group = new fabric.Group([], {
                id: `group_${Date.now()}`,
                name: `Group ${canvas.getObjects().filter(obj => obj.type === 'group').length + 1}`,
                selectable: true,
                evented: true,
                visible: true,
                opacity: 1
            });

            // Добавляем каждый объект в группу по отдельности
            objectsToGroup.forEach((obj, index) => {
                const state = objectsState[index];

                // Убираем объект с холста
                canvas.remove(obj);

                // НОВОЕ: Сохраняем анимационные свойства перед добавлением в группу
                const animationProps = {
                    animated: state.animated,
                    animationTime: state.animationTime,
                    animationSettings: state.animationSettings,
                    baseScaleX: state.baseScaleX,
                    baseScaleY: state.baseScaleY,
                    originalLeft: state.originalLeft,
                    originalTop: state.originalTop
                };

                // Убеждаемся, что объект виден
                obj.set({
                    visible: true,
                    opacity: state.opacity || 1,
                    selectable: true,
                    evented: true
                });

                // Добавляем в группу
                group.addWithUpdate(obj);

                // НОВОЕ: Восстанавливаем анимационные свойства после добавления в группу
                if (animationProps.animated) {
                    obj.animated = animationProps.animated;
                    obj.animationTime = animationProps.animationTime || 0;
                    obj.animationSettings = animationProps.animationSettings || {
                        pulseScale: 0.15,
                        rotationSpeed: 0.3,
                        opacityRange: 0.4,
                        moveAmplitude: 0.8,
                        skewAmount: 5
                    };
                    obj.baseScaleX = animationProps.baseScaleX || obj.scaleX;
                    obj.baseScaleY = animationProps.baseScaleY || obj.scaleY;
                    obj.originalLeft = animationProps.originalLeft || obj.left;
                    obj.originalTop = animationProps.originalTop || obj.top;

                    console.log(`Restored animation for object in group:`, {
                        animated: obj.animated,
                        animationTime: obj.animationTime,
                        animationSettings: obj.animationSettings
                    });
                }
            });

            // Добавляем группу на холст
            canvas.add(group);

            console.log('Group created:', group);
            console.log('Group position:', { left: group.left, top: group.top });
            console.log('Group size:', { width: group.width, height: group.height });
            console.log('Group visible:', group.visible);
            console.log('Group objects count:', group.size());

            // Устанавливаем группу как активную
            canvas.setActiveObject(group);

            // Принудительно обновляем координаты
            group.setCoords();

            // Обновляем canvas
            canvas.renderAll();

            // Автоматически разворачиваем новую группу и устанавливаем её как выделенную
            setExpandedGroups(prev => new Set([...prev, group.id]));
            setSelectedLayers([group.id]);

            console.log('Group creation completed successfully');

        } catch (error) {
            console.error('Error creating group:', error);
            alert('Ошибка при создании группы: ' + error.message);
        }
    };

    // ИСПРАВЛЕННАЯ функция разгруппировки
    const ungroupSelected = () => {
        if (!canvas) return;

        const activeObject = canvas.getActiveObject();
        console.log('Ungrouping object:', activeObject);

        if (activeObject && activeObject.type === 'group') {
            // Используем встроенный метод Fabric.js для разгруппировки
            const items = activeObject.toActiveSelection();

            console.log('Ungrouped items:', items);

            // Убираем группу из развернутых
            setExpandedGroups(prev => {
                const newSet = new Set(prev);
                newSet.delete(activeObject.id);
                return newSet;
            });

            canvas.requestRenderAll();
            console.log('Ungrouping completed');
        }
    };

    if (!isVisible) return null;

    return (
        <div className="layers-panel">
            {/* Заголовок */}
            <div className="layers-panel-header">
                <h3 className="layers-panel-title">layers</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {selectedLayers.length >= 2 && (
                        <span
                            onClick={createGroup}
                            style={{
                                fontSize: '16px',
                                cursor: 'pointer',
                                opacity: 0.7,
                                transition: 'opacity 0.2s'
                            }}
                            title="create group"
                            onMouseEnter={(e) => e.target.style.opacity = '1'}
                            onMouseLeave={(e) => e.target.style.opacity = '0.7'}
                        >
                            📦
                        </span>
                    )}
                    <span
                        onClick={ungroupSelected}
                        style={{
                            fontSize: '16px',
                            cursor: 'pointer',
                            opacity: 0.7,
                            transition: 'opacity 0.2s'
                        }}
                        title="ungroup"
                        onMouseEnter={(e) => e.target.style.opacity = '1'}
                        onMouseLeave={(e) => e.target.style.opacity = '0.7'}
                    >
                        📤
                    </span>
                    <span
                        onClick={onClose}
                        style={{
                            fontSize: '16px',
                            cursor: 'pointer',
                            opacity: 0.7,
                            transition: 'opacity 0.2s'
                        }}
                        title="close"
                        onMouseEnter={(e) => e.target.style.opacity = '1'}
                        onMouseLeave={(e) => e.target.style.opacity = '0.7'}
                    >
                        ✕
                    </span>
                </div>
            </div>

            {/* Список слоев */}
            <div className="layers-list">
                {layers.map((layer, index) => (
                    <div
                        key={layer.id}
                        className={`layer-item ${selectedLayers.includes(layer.id) ? 'selected' : ''}`}
                        style={{
                            paddingLeft: `${10 + layer.level * 18}px`
                        }}
                        onClick={(e) => selectLayer(layer, e.ctrlKey || e.metaKey)}
                    >
                        {/* Стрелка разворачивания для групп */}
                        {layer.isGroup && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleGroupExpanded(layer.id);
                                }}
                                style={{
                                    padding: '4px',
                                    marginRight: '6px',
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    width: '16px',
                                    height: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '2px',
                                    color: '#666'
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#e9ecef'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = 'none'}
                            >
                                <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                                    {expandedGroups.has(layer.id) ? 
                                        <path d="M1 2 L4 5 L7 2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                                        :
                                        <path d="M2 1 L5 4 L2 7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                                    }
                                </svg>
                            </button>
                        )}

                        {/* Иконка типа объекта */}
                        <div style={{
                            width: '16px',
                            height: '16px',
                            marginRight: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: layer.isGroup ? '#ff6b35' : layer.type === 'image' ? '#4a90e2' : layer.type === 'text' ? '#28a745' : '#6c757d'
                        }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                {layer.isGroup ? (
                                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                                ) : layer.type === 'image' ? (
                                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                                ) : layer.type === 'text' ? (
                                    <path d="M5 17v2h14v-2H5zm4.5-4.2h5l.9 2.2h2.1L12.75 4h-1.5L6.5 15h2.1l.9-2.2zM12 5.98L13.87 11h-3.74L12 5.98z"/>
                                ) : (
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                )}
                            </svg>
                        </div>

                        {/* Название слоя */}
                        <div className={`layer-name ${!layer.visible ? 'hidden' : ''}`}>
                            {layer.name}
                        </div>

                        {/* Кнопки управления */}
                        <div className="layer-controls">
                            {/* Видимость */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleLayerVisibility(layer);
                                }}
                                style={{
                                    padding: '5px',
                                    border: 'none',
                                    background: layer.visible ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)',
                                    cursor: 'pointer',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: layer.visible ? '#28a745' : '#dc3545',
                                    transition: 'all 0.15s ease'
                                }}
                                title={layer.visible ? 'Hide layer' : 'Show layer'}
                                onMouseEnter={(e) => {
                                    e.target.style.backgroundColor = layer.visible ? 'rgba(40, 167, 69, 0.2)' : 'rgba(220, 53, 69, 0.2)';
                                    e.target.style.transform = 'scale(1.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.backgroundColor = layer.visible ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)';
                                    e.target.style.transform = 'scale(1)';
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    {layer.visible ? (
                                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                                    ) : (
                                        <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                                    )}
                                </svg>
                            </button>

                            {/* Блокировка */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleLayerLock(layer);
                                }}
                                style={{
                                    padding: '5px',
                                    border: 'none',
                                    background: layer.locked ? 'rgba(220, 53, 69, 0.1)' : 'rgba(108, 117, 125, 0.1)',
                                    cursor: 'pointer',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: layer.locked ? '#dc3545' : '#6c757d',
                                    transition: 'all 0.15s ease'
                                }}
                                title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                                onMouseEnter={(e) => {
                                    e.target.style.backgroundColor = layer.locked ? 'rgba(220, 53, 69, 0.2)' : 'rgba(108, 117, 125, 0.2)';
                                    e.target.style.transform = 'scale(1.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.backgroundColor = layer.locked ? 'rgba(220, 53, 69, 0.1)' : 'rgba(108, 117, 125, 0.1)';
                                    e.target.style.transform = 'scale(1)';
                                }}
                            >
                                <svg width="12" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    {layer.locked ? (
                                        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                                    ) : (
                                        <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2z"/>
                                    )}
                                </svg>
                            </button>

                            {/* Показываем кнопки перемещения только для top-level объектов */}
                            {!layer.parent && (
                                <>
                                    {/* Вверх */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            moveLayerUp(layer);
                                        }}
                                        style={{
                                            padding: '5px',
                                            border: 'none',
                                            background: 'rgba(108, 117, 125, 0.1)',
                                            cursor: 'pointer',
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#6c757d',
                                            transition: 'all 0.15s ease'
                                        }}
                                        title="Move layer up"
                                        onMouseEnter={(e) => {
                                            e.target.style.backgroundColor = 'rgba(74, 144, 226, 0.2)';
                                            e.target.style.color = '#4a90e2';
                                            e.target.style.transform = 'scale(1.1)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.backgroundColor = 'rgba(108, 117, 125, 0.1)';
                                            e.target.style.color = '#6c757d';
                                            e.target.style.transform = 'scale(1)';
                                        }}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
                                        </svg>
                                    </button>

                                    {/* Вниз */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            moveLayerDown(layer);
                                        }}
                                        style={{
                                            padding: '5px',
                                            border: 'none',
                                            background: 'rgba(108, 117, 125, 0.1)',
                                            cursor: 'pointer',
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#6c757d',
                                            transition: 'all 0.15s ease'
                                        }}
                                        title="Move layer down"
                                        onMouseEnter={(e) => {
                                            e.target.style.backgroundColor = 'rgba(74, 144, 226, 0.2)';
                                            e.target.style.color = '#4a90e2';
                                            e.target.style.transform = 'scale(1.1)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.backgroundColor = 'rgba(108, 117, 125, 0.1)';
                                            e.target.style.color = '#6c757d';
                                            e.target.style.transform = 'scale(1)';
                                        }}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/>
                                        </svg>
                                    </button>
                                </>
                            )}

                            {/* Удалить */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Delete layer?')) {
                                        deleteLayer(layer);
                                    }
                                }}
                                style={{
                                    padding: '5px',
                                    border: 'none',
                                    background: 'rgba(220, 53, 69, 0.1)',
                                    cursor: 'pointer',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#dc3545',
                                    transition: 'all 0.15s ease'
                                }}
                                title="Delete layer"
                                onMouseEnter={(e) => {
                                    e.target.style.backgroundColor = 'rgba(220, 53, 69, 0.2)';
                                    e.target.style.transform = 'scale(1.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.backgroundColor = 'rgba(220, 53, 69, 0.1)';
                                    e.target.style.transform = 'scale(1)';
                                }}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Подсказка */}
            <div className="layers-panel-footer">
                ctrl+click multiselect<br/>
                ▶ expand group
            </div>
        </div>
    );
};

// Делаем LayersPanel доступным глобально
if (typeof window !== 'undefined') {
    window.LayersPanel = LayersPanel;
} else if (typeof global !== 'undefined') {
    global.LayersPanel = LayersPanel;
} else if (typeof globalThis !== 'undefined') {
    globalThis.LayersPanel = LayersPanel;
} else {
    console.error('Unable to find global object to attach LayersPanel');
}

console.log('LayersPanel.js has finished loading');