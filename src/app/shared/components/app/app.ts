import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FaceTryonComponent } from "../facemesh/facemesh";

@Component({
    selector: 'app-root',
    imports: [
        FaceTryonComponent
    ],
    templateUrl: './app.html',
    styleUrl: './app.scss'
})
export class App {
    protected readonly title = signal('mirror-ui');
}
