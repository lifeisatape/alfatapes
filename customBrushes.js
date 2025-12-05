console.log('Loading custom brushes...');

fabric.CrayonBrush = fabric.util.createClass(fabric.BaseBrush, {
    color: '#000000',
    opacity: 0.8,
    width: 10,
    textureScale: 2,
    strokeVariation: 0.5,
    pressureVariation: 0.3,
    graininess: 0.7,
    strokeCount: 5,
    grainSize: 3,
    animated: false,
    animationTime: 0,
    animationSpeed: 0.05,

    initialize: function(canvas) {
        console.log('Initializing CrayonBrush');
        this.canvas = canvas;
        this._points = [];
        this.createPatternCanvas();
    },

    createPatternCanvas: function() {
        console.log('Creating pattern canvas');
        this.patternCanvas = document.createElement('canvas');
        const patternSize = Math.round(50 * this.textureScale);
        this.patternCanvas.width = this.patternCanvas.height = patternSize;
        this.updatePatternCanvas();
    },

    updatePatternCanvas: function() {
        console.log('Updating pattern canvas');
        const patternCtx = this.patternCanvas.getContext('2d');
        patternCtx.clearRect(0, 0, this.patternCanvas.width, this.patternCanvas.height);

        // Сбрасываем все параметры контекста для iOS совместимости
        patternCtx.globalAlpha = 1;
        patternCtx.globalCompositeOperation = 'source-over';
        patternCtx.fillStyle = this.color;

        for (let i = 0; i < this.patternCanvas.width; i += this.grainSize) {
            for (let j = 0; j < this.patternCanvas.height; j += this.grainSize) {
                // Устанавливаем альфу перед каждым рисованием
                const alpha = Math.random() * this.graininess + (1 - this.graininess) / 3;
                patternCtx.globalAlpha = alpha;
                // Переустанавливаем цвет для каждого пикселя на iOS
                patternCtx.fillStyle = this.color;
                patternCtx.fillRect(i, j, this.grainSize, this.grainSize);
            }
        }

        // Сбрасываем альфу обратно
        patternCtx.globalAlpha = 1;
    },

    onMouseDown: function(pointer) {
        console.log('Mouse down on CrayonBrush');
        this._points = [pointer];
        this.updatePatternCanvas();

        this.minX = pointer.x;
        this.maxX = pointer.x;
        this.minY = pointer.y;
        this.maxY = pointer.y;
        this.animationTime = 0;

        this.strokeData = [];
    },

    onMouseMove: function(pointer) {
        console.log('Mouse move on CrayonBrush');
        this._points.push(pointer);

        this.minX = Math.min(this.minX, pointer.x - this.width);
        this.maxX = Math.max(this.maxX, pointer.x + this.width);
        this.minY = Math.min(this.minY, pointer.y - this.width);
        this.maxY = Math.max(this.maxY, pointer.y + this.width);

        const tempCanvas = document.createElement('canvas');
        const width = Math.ceil(this.maxX - this.minX + this.width * 2);
        const height = Math.ceil(this.maxY - this.minY + this.width * 2);
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');

        tempCtx.globalAlpha = this.opacity;
        // Для iOS создаем паттерн с проверкой
        try {
            tempCtx.strokeStyle = tempCtx.createPattern(this.patternCanvas, 'repeat');
            // Если паттерн не создался корректно, используем прямой цвет
            if (!tempCtx.strokeStyle) {
                tempCtx.strokeStyle = this.color;
            }
        } catch (e) {
            // Fallback для старых iOS устройств
            console.log('Pattern creation failed, using direct color');
            tempCtx.strokeStyle = this.color;
        }

        const offsetX = this.minX - this.width;
        const offsetY = this.minY - this.width;

        for (let i = 1; i < this._points.length; i++) {
            const point = this._points[i];
            const prevPoint = this._points[i - 1];

            for (let j = 0; j < this.strokeCount; j++) {
                const xOffset = (Math.random() - 0.5) * this.width * this.strokeVariation * this.textureScale;
                const yOffset = (Math.random() - 0.5) * this.width * this.strokeVariation * this.textureScale;

                // Переустанавливаем strokeStyle для каждого штриха на iOS
                try {
                    const pattern = tempCtx.createPattern(this.patternCanvas, 'repeat');
                    tempCtx.strokeStyle = pattern || this.color;
                } catch (e) {
                    tempCtx.strokeStyle = this.color;
                }

                tempCtx.beginPath();
                tempCtx.moveTo(prevPoint.x - offsetX + xOffset, prevPoint.y - offsetY + yOffset);

                const pressure = Math.sin((i / this._points.length) * Math.PI) * this.pressureVariation + (1 - this.pressureVariation);
                tempCtx.lineWidth = this.width * pressure * (1 - this.strokeVariation / 2 + Math.random() * this.strokeVariation) * this.textureScale;

                tempCtx.lineTo(point.x - offsetX + xOffset, point.y - offsetY + yOffset);
                tempCtx.stroke();
            }
        }

        this.canvas.contextTop.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.canvas.contextTop.save();

        const vpt = this.canvas.viewportTransform;
        this.canvas.contextTop.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);

        this.canvas.contextTop.drawImage(tempCanvas, offsetX, offsetY);

        this.canvas.contextTop.restore();

        this.currentStroke = {
            canvas: tempCanvas,
            offsetX: offsetX,
            offsetY: offsetY,
            width: width,
            height: height
        };
    },

    trimCanvas: function(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let minX = canvas.width;
        let minY = canvas.height;
        let maxX = 0;
        let maxY = 0;

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const alpha = data[(y * canvas.width + x) * 4 + 3];
                if (alpha > 0) {
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
        }

        if (minX > maxX) {
            const emptyCanvas = document.createElement('canvas');
            emptyCanvas.width = emptyCanvas.height = 1;
            return { canvas: emptyCanvas, offsetX: 0, offsetY: 0 };
        }

        const trimmedWidth = maxX - minX + 1;
        const trimmedHeight = maxY - minY + 1;
        const trimmedCanvas = document.createElement('canvas');
        trimmedCanvas.width = trimmedWidth;
        trimmedCanvas.height = trimmedHeight;

        const trimmedCtx = trimmedCanvas.getContext('2d');
        trimmedCtx.drawImage(
            canvas,
            minX, minY, trimmedWidth, trimmedHeight,
            0, 0, trimmedWidth, trimmedHeight
        );

        return {
            canvas: trimmedCanvas,
            offsetX: minX,
            offsetY: minY
        };
    },

    onMouseUp: function() {
        console.log('Mouse up on CrayonBrush');

        if (!this.currentStroke) return;
        const trimmed = this.trimCanvas(this.currentStroke.canvas);
        const finalLeft = this.currentStroke.offsetX + trimmed.offsetX;
        const finalTop = this.currentStroke.offsetY + trimmed.offsetY;
        
        const image = new fabric.Image(trimmed.canvas, {
            left: finalLeft,
            top: finalTop,
            scaleX: 1,
            scaleY: 1,
            angle: 0,
            opacity: 1.0,
            selectable: true,
            evented: true,
            animated: this.animated || false,
            animationTime: this.animated ? Math.random() * 100 : 0,
            baseScaleX: 1,
            baseScaleY: 1,
            originalLeft: finalLeft,
            originalTop: finalTop,
            animationSettings: this.animated ? {...(this.animationSettings || {
                pulseScale: 0.1,
                rotationSpeed: 0,
                opacityRange: 0,
                moveAmplitude: 0.2,
                skewAmount: 2
            })} : {
                pulseScale: 0,
                rotationSpeed: 0,
                opacityRange: 0,
                moveAmplitude: 0,
                skewAmount: 0
            }
        });
        
        // Принудительно устанавливаем базовые значения после создания
        image.baseScaleX = 1;
        image.baseScaleY = 1;

        console.log('Created image with animated:', image.animated, 'pulseScale:', image.animationSettings?.pulseScale);
        console.log('Brush animationSettings at creation:', this.animationSettings);

        this.canvas.add(image);
        this.canvas.clearContext(this.canvas.contextTop);
        this._points = [];
        this.currentStroke = null;
        this.canvas.renderAll();
    }
});
