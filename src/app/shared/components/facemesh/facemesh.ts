import {
    AfterViewInit,
    Component,
    ElementRef,
    OnDestroy,
    OnInit,
    ViewChild
} from '@angular/core';
import { FaceMesh } from '@mediapipe/face_mesh';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { DecimalPipe } from '@angular/common';

@Component({
    selector: 'app-facemesh',
    templateUrl: './facemesh.html',
    styleUrls: ['./facemesh.scss'],
    standalone: true,
    imports: [
        MatButtonToggleModule,
        MatCheckboxModule,
        ReactiveFormsModule,
        DecimalPipe,
        FormsModule
    ]
})
export class FaceTryonComponent implements OnInit, OnDestroy, AfterViewInit {

    @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;
    @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

    public faceMesh!: FaceMesh;
    public zoom: number = 1.0; // Default = 100%
    public liveCaptureControl = new FormControl<boolean>(true);
    public captureControl = new FormControl<boolean>(false);
    private lastLandmarks!: any[];
    private skinColour!: string;
    private capturedLandmarks: number[] = [];
    private stream!: MediaStream;
    private eyelashImage = new Image();
    private destroy$ = new Subject<void>();

    ngOnInit(): void {
        this.eyelashImage.src = 'lash.png';
        this.eyelashImage.crossOrigin = 'anonymous';
    }

    async ngAfterViewInit(): Promise<void> {

        this.stream = await navigator.mediaDevices.getUserMedia({ video: true });

        this.canvasRef.nativeElement.addEventListener('click', this.onCanvasClick.bind(this));
        this.videoRef.nativeElement.srcObject = this.stream;
        this.videoRef.nativeElement.play();

        this.faceMesh = new FaceMesh({
            locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });

        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            selfieMode: true
        });


        this.liveCaptureControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
            this.detectVideoLoop();
        });

        this.captureControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((setting: any) => {
            if (!setting) {
                this.capturedLandmarks = [];
            }
        });

        this.faceMesh.onResults(results => this.renderMakeup(results));
        this.detectVideoLoop();
    }

    /**
     * loop over and animate captured image
     */
    private async detectVideoLoop() {
        const video = this.videoRef.nativeElement;
        let frameCaptured = 10;
        const processFrame = async () => {
            if (video.readyState >= 2) {
                await this.faceMesh.send({ image: video });
                if (!this.liveCaptureControl.value && frameCaptured <= 0) {
                    return;
                }
                frameCaptured--;
            }
            requestAnimationFrame(processFrame);
        };
        processFrame();
    }

    /**
     * render makeup over video / image
     * 
     * @param results 
     */
    private renderMakeup(results: any) {
        const canvas = this.canvasRef.nativeElement;
        const ctx = canvas.getContext('2d')!;
        canvas.width = this.videoRef.nativeElement.videoWidth;
        canvas.height = this.videoRef.nativeElement.videoHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

        if (results.multiFaceLandmarks.length === 0) return;
        const landmarks = results.multiFaceLandmarks[0];
        this.lastLandmarks = landmarks;

        this.skinColour = this.getAverageSkinColourFromLandmarks(ctx, landmarks);

        // this.drawLips(ctx, landmarks);
        // this.hideFacialHair(ctx, landmarks);
        // this.drawFoundation(ctx, landmarks);
        // this.drawEyeliner(ctx, landmarks);
        // this.drawEyeshadow(ctx, landmarks);
        // this.drawEyelashes(ctx, landmarks);
        this.drawBlush(ctx, landmarks);

        const rightUpperLid = [33, 7, 163, 144, 145, 153, 154, 155, 133];
        const leftUpperLid = [263, 249, 390, 373, 374, 380, 381, 382, 362];

        this.drawLandmarkLines(ctx, landmarks, rightUpperLid);

        if (this.eyelashImage.complete) {
            // this.drawEyelashImage(ctx, landmarks, rightUpperLid, this.eyelashImage);
            // this.drawEyelashImage(ctx, landmarks, leftUpperLid, this.eyelashImage, true);
        }
    }

    /**
     * render lip component
     * 
     * @param ctx CanvasRenderingContext2D
     * @param landmarks any[]
     */
    private drawLips(ctx: CanvasRenderingContext2D, landmarks: any[]) {

        const canvas = this.canvasRef.nativeElement;
        const w = canvas.width;
        const h = canvas.height;

        const outer = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
        const inner = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];

        ctx.save();
        ctx.beginPath();

        // Outer lip shape
        outer.forEach((i, idx) => {
            const pt = landmarks[i];
            if (idx === 0) ctx.moveTo(pt.x * w, pt.y * h);
            else ctx.lineTo(pt.x * w, pt.y * h);
        });
        ctx.closePath();

        // Inner lip shape (subtracting this from the fill area)
        ctx.moveTo(landmarks[inner[0]].x * w, landmarks[inner[0]].y * h);
        inner.forEach((i, idx) => {
            const pt = landmarks[i];
            if (idx === 0) ctx.moveTo(pt.x * w, pt.y * h);
            else ctx.lineTo(pt.x * w, pt.y * h);
        });
        ctx.closePath();

        // Fill outer - inner using evenodd fill rule
        ctx.fillStyle = 'rgba(255, 0, 120, 0.6)';
        ctx.fill('evenodd');
        ctx.restore();
    }

    private drawEyeliner(ctx: CanvasRenderingContext2D, landmarks: any[]) {

        const canvas = this.canvasRef.nativeElement;
        const w = canvas.width;
        const h = canvas.height;

        const rightEye = [33, 7, 163, 144, 145, 153, 154, 155, 133];
        const leftEye = [263, 249, 390, 373, 374, 380, 381, 382, 362];

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        // Draw right eyeliner
        ctx.beginPath();
        rightEye.forEach((i, idx) => {
            const pt = landmarks[i];
            if (idx === 0) ctx.moveTo(pt.x * w, pt.y * h);
            else ctx.lineTo(pt.x * w, pt.y * h);
        });
        ctx.stroke();

        // Draw left eyeliner
        ctx.beginPath();
        leftEye.forEach((i, idx) => {
            const pt = landmarks[i];
            if (idx === 0) ctx.moveTo(pt.x * w, pt.y * h);
            else ctx.lineTo(pt.x * w, pt.y * h);
        });
        ctx.stroke();
    }

    private drawEyeshadow(ctx: CanvasRenderingContext2D, landmarks: any[]) {
        const w = this.canvasRef.nativeElement.width;
        const h = this.canvasRef.nativeElement.height;

        const right = [
            33, 246, 161, 160, 159, 158, 157, 173, 133
        ];

        const left = [
            263, 466, 388, 387, 386, 385, 384, 398, 362
        ];

        const fillRegion = (points: number[]) => {
            ctx.beginPath();
            points.forEach((i, idx) => {
                const pt = landmarks[i];
                if (idx === 0) ctx.moveTo(pt.x * w, pt.y * h);
                else ctx.lineTo(pt.x * w, pt.y * h);
            });
            ctx.closePath();
            ctx.fill();
        };

        ctx.save();
        ctx.fillStyle = 'rgba(138, 43, 226, 0.3)'; // soft purple
        fillRegion(right);
        fillRegion(left);
        ctx.restore();
    }

    private drawBlush(ctx: CanvasRenderingContext2D, landmarks: any[]) {
        const w = this.canvasRef.nativeElement.width;
        const h = this.canvasRef.nativeElement.height;

        const colour: string = '#ff69b4'; // default: hot pink
        const opacity: number = 0.4;      // default: semi-soft

        const cheeks = [
            { cx: landmarks[50], side: 'right' },   // right cheek
            { cx: landmarks[280], side: 'left' }    // left cheek
        ];

        cheeks.forEach(({ cx }) => {
            const x = cx.x * w;
            const y = cx.y * h;

            const radius = w * 0.04; // radius ~5% of image width

            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, this.hexToRgba(colour, opacity));
            gradient.addColorStop(1, this.hexToRgba(colour, 0));

            ctx.save();
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    private drawEyelashes(
        ctx: CanvasRenderingContext2D,
        landmarks: any[],
        length: number = 10,       // in pixels
        thickness: number = 2,     // line width
        fanSpread: number = 0.5    // curve factor (0 = vertical, 1 = wide fan)
    ) {
        const w = this.canvasRef.nativeElement.width;
        const h = this.canvasRef.nativeElement.height;

        const rightLashLine = [33, 7, 163, 144, 145, 153, 154, 155, 133];
        const leftLashLine = [263, 249, 390, 373, 374, 380, 381, 382, 362];

        const drawLashes = (indices: number[], reverse: boolean = false) => {
            for (let i = 0; i < indices.length; i++) {
                const idx = indices[i];
                const pt = landmarks[idx];
                const x = pt.x * w;
                const y = pt.y * h;

                // Direction vector (based on fan spread)
                const dx = (reverse ? -1 : 1) * (i - indices.length / 2) * fanSpread;
                const dy = -1; // always upward from eye

                // Normalize direction
                const mag = Math.sqrt(dx * dx + dy * dy) || 1;
                const ux = dx / mag;
                const uy = dy / mag;

                const endX = x + ux * length;
                const endY = y + uy * length;

                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
        };

        ctx.save();
        ctx.strokeStyle = 'black';
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';

        drawLashes(rightLashLine);
        drawLashes(leftLashLine, true); // mirror fan direction
        ctx.restore();
    }

    private drawFoundation(
        ctx: CanvasRenderingContext2D,
        landmarks: any[],
        colour: string = '#ffe0bd', // light beige default
        opacity: number = 0.3
    ) {
        const w = this.canvasRef.nativeElement.width;
        const h = this.canvasRef.nativeElement.height;

        // Rough face border (chin -> jaw -> temples -> forehead -> jawline)
        const faceOutline = [
            10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
            397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
            172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10
        ];

        // Eyes and mouth (to exclude)
        const leftEye = [263, 249, 390, 373, 374, 380, 381, 382, 362];
        const rightEye = [33, 7, 163, 144, 145, 153, 154, 155, 133];
        const outerLips = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291];
        const innerLips = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];

        ctx.save();
        ctx.fillStyle = this.hexToRgba(colour, opacity);
        ctx.beginPath();

        // Draw base face polygon
        faceOutline.forEach((i, idx) => {
            const pt = landmarks[i];
            if (idx === 0) ctx.moveTo(pt.x * w, pt.y * h);
            else ctx.lineTo(pt.x * w, pt.y * h);
        });
        ctx.closePath();

        // Cut out eyes and lips
        const punchHole = (indices: number[]) => {
            ctx.moveTo(landmarks[indices[0]].x * w, landmarks[indices[0]].y * h);
            indices.forEach(i => ctx.lineTo(landmarks[i].x * w, landmarks[i].y * h));
            ctx.closePath();
        };

        [leftEye, rightEye, outerLips, innerLips].forEach(punchHole);

        ctx.fill('evenodd');
        ctx.restore();
    }

    private drawEyelashImage(
        ctx: CanvasRenderingContext2D,
        lm: any[],
        indices: number[],
        img: HTMLImageElement,
        mirror: boolean = false
    ) {
        const w = this.canvasRef.nativeElement.width;
        const h = this.canvasRef.nativeElement.height;

        // Calculate arc center (midpoint of upper lid)
        const midIndex = indices[Math.floor(indices.length / 2)];
        const pt = lm[midIndex];
        const cx = pt.x * w;
        const cy = pt.y * h;

        // Estimate tilt angle from first and last point
        const start = lm[indices[0]];
        const end = lm[indices[indices.length - 1]];
        const dx = (end.x - start.x) * w;
        const dy = (end.y - start.y) * h;
        const angle = Math.atan2(dy, dx);

        // Estimate scale from arc length
        const arcWidth = Math.hypot(dx, dy);
        const scale = arcWidth / img.width;

        const imgW = img.width * scale;
        const imgH = img.height * scale;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        if (mirror) ctx.scale(-1, 1);

        ctx.drawImage(img, -imgW / 2, -imgH / 2, imgW, imgH);
        ctx.restore();
    }


    private hideFacialHair(
        ctx: CanvasRenderingContext2D,
        landmarks: any[],
        skinColour: string = this.skinColour,
        opacity: number = 0.35
    ) {
        const w = this.canvasRef.nativeElement.width;
        const h = this.canvasRef.nativeElement.height;

        // Chin, jawline, sideburns, cheeks
        const beardArea = [
            152, 148, 176, 149, 150, 136, 172, 58, 132, 93,
            234, 127, 162, 21, 54, 103, 67, 109, 10, 151, 9, 8, 168, 197, 4
        ];

        // Moustache / upper lip
        const moustacheArea = [
            61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291,
            375, 321, 405, 314, 17, 84, 181, 91, 146
        ];

        const fillRegion = (indices: number[]) => {
            ctx.beginPath();
            indices.forEach((i, idx) => {
                const pt = landmarks[i];
                if (idx === 0) ctx.moveTo(pt.x * w, pt.y * h);
                else ctx.lineTo(pt.x * w, pt.y * h);
            });
            ctx.closePath();
            ctx.fill();
        };

        ctx.save();
        ctx.fillStyle = this.hexToRgba(skinColour, opacity);

        fillRegion(beardArea);
        fillRegion(moustacheArea);

        ctx.restore();
    }

    private getAverageSkinColourFromLandmarks(
        ctx: CanvasRenderingContext2D,
        landmarks: any[],
        region: number[] = [10, 67, 109, 151, 9, 8, 168, 197, 4] // forehead
    ): string {
        const w = this.canvasRef.nativeElement.width;
        const h = this.canvasRef.nativeElement.height;

        const xs: number[] = [];
        const ys: number[] = [];

        ctx.save();

        // Define forehead mask
        ctx.beginPath();
        region.forEach((i, idx) => {
            const pt = landmarks[i];
            const x = pt.x * w;
            const y = pt.y * h;
            xs.push(x);
            ys.push(y);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.clip();

        // Limit to bounding box for speed
        const minX = Math.floor(Math.min(...xs));
        const minY = Math.floor(Math.min(...ys));
        const maxX = Math.ceil(Math.max(...xs));
        const maxY = Math.ceil(Math.max(...ys));
        const width = maxX - minX;
        const height = maxY - minY;

        const data = ctx.getImageData(minX, minY, width, height).data;

        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha > 0) {
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
                count++;
            }
        }

        ctx.restore();

        if (count === 0) return '#ffe0bd'; // fallback

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        return `#${this.toHex(r)}${this.toHex(g)}${this.toHex(b)}`;
    }

    private drawLandmarkLines(
        ctx: CanvasRenderingContext2D,
        lm: any[],
        indices: number[],
        options: {
            color?: string,
            width?: number,
            closed?: boolean
        } = {}
    ) {
        const w = this.canvasRef.nativeElement.width;
        const h = this.canvasRef.nativeElement.height;

        ctx.save();
        ctx.strokeStyle = options.color || 'red';
        ctx.lineWidth = options.width || 1;
        ctx.beginPath();

        indices.forEach((i, idx) => {
            const pt = lm[i];
            const x = pt.x * w;
            const y = pt.y * h;
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        if (options.closed) ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }

    /**
     * 
     * 
     * @param event MouseEvent
     * @returns 
     */
    private onCanvasClick(event: MouseEvent) {
        const canvas = this.canvasRef.nativeElement;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        if (!this.lastLandmarks) return;

        const w = canvas.width;
        const h = canvas.height;

        // Find closest landmark
        let minDist = Infinity;
        let closestIndex = -1;

        this.lastLandmarks.forEach((pt, i) => {
            const px = pt.x * w;
            const py = pt.y * h;
            const dist = Math.hypot(px - x, py - y);
            if (dist < minDist) {
                minDist = dist;
                closestIndex = i;
            }
        });

        if (closestIndex !== -1) {
            const pt = this.lastLandmarks[closestIndex];
            if (this.capturedLandmarks[this.capturedLandmarks.length - 1] !== closestIndex) {
                this.capturedLandmarks.push(closestIndex);
            }
            console.log('captured', this.capturedLandmarks);
            // console.log(`Clicked landmark #${closestIndex}: x=${pt.x}, y=${pt.y}`);
        }
    }

    private hexToRgba(hex: string, alpha: number): string {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    private toHex(n: number): string {
        return n.toString(16).padStart(2, '0');
    }

    ngOnDestroy() {
        this.stream?.getTracks().forEach(track => track.stop());
    }
}