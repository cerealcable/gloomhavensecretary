import { CdkDragDrop, CdkDragEnter, CdkDragExit, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, ElementRef, OnInit } from '@angular/core';
import { gameManager, GameManager } from 'src/app/game/businesslogic/GameManager';
import { GameState } from 'src/app/game/model/Game';
import { SettingsManager, settingsManager } from '../game/businesslogic/SettingsManager';
import { Character } from '../game/model/Character';
import { Monster } from '../game/model/Monster';

@Component({
  selector: 'ghs-main',
  templateUrl: './main.html',
  styleUrls: [ './main.scss' ],
})
export class MainComponent implements OnInit {

  gameManager: GameManager = gameManager;
  settingsManager: SettingsManager = settingsManager;
  GameState = GameState;

  columnSize: number = 3;
  columns: number = 2;

  resizeObserver: ResizeObserver;

  fullviewChar: Character | undefined;

  constructor(private element: ElementRef) {
    gameManager.uiChange.subscribe({
      next: () => {
        const figure = gameManager.game.figures.find((figure) => figure instanceof Character && figure.fullview);
        if (figure) {
          this.fullviewChar = figure as Character;
        } else {
          this.fullviewChar = undefined;
          this.calcColumns();
        }
      }
    })

    this.resizeObserver = new ResizeObserver((elements) => {
      if (!this.fullviewChar) {
        this.calcColumns();
      }
    })
  }

  async ngOnInit() {
    document.body.classList.add('no-select');
    await settingsManager.init();
    gameManager.stateManager.init();
    document.body.style.setProperty('--ghs-factor', settingsManager.settings.zoom + '');
    document.body.style.setProperty('--ghs-barsize', settingsManager.settings.barsize + '');
    document.body.style.setProperty('--ghs-fontsize', settingsManager.settings.fontsize + '');

    const figure = gameManager.game.figures.find((figure) => figure instanceof Character && figure.fullview);
    if (figure) {
      this.fullviewChar = figure as Character;
    } else {
      this.fullviewChar = undefined;
      this.calcColumns();
    }

    window.addEventListener('resize', (event) => {
      if (!this.fullviewChar) {
        this.calcColumns();
      }
    });

    window.addEventListener('fullscreenchange', (event) => {
      if (!this.fullviewChar) {
        this.calcColumns();
      }
    });

    window.addEventListener('focus', (event) => {
      if (settingsManager.settings.serverAutoconnect && gameManager.stateManager.wsState() == WebSocket.CLOSED) {
        gameManager.stateManager.connect();
      }
    });

    window.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        gameManager.stateManager.undo();
      } else if (event.ctrlKey && event.key === 'y' || event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'z') {
        gameManager.stateManager.redo();
      }
    })
  }

  calcColumns(scrollTo: HTMLElement | undefined = undefined): void {
    if (settingsManager.settings.disableColumns) {
      this.columns = 1;
      this.columnSize = 99;
      setTimeout(() => {
        this.translate(scrollTo);
      }, 0)
    } else {
      setTimeout(() => {
        const container = this.element.nativeElement.getElementsByClassName('figures')[ 0 ];
        if (container) {
          const figures = container.getElementsByClassName('figure');

          for (let i = 0; i < figures.length; i++) {
            this.resizeObserver.observe(figures[ i ]);
          }
          let figureWidth = container.clientWidth;
          if (figures.length > 0) {
            figureWidth = figures[ 0 ].firstChild.clientWidth;
          }

          if (figureWidth < (container.clientWidth / 2)) {
            let height = 0;
            let columnSize = 0;
            const minColumn = Math.ceil(gameManager.game.figures.length / 2);
            while ((height < container.clientHeight || columnSize < minColumn) && columnSize < figures.length) {
              height += figures[ columnSize ].clientHeight;
              columnSize++;
            }

            if (columnSize == gameManager.game.figures.length && height > container.clientHeight) {
              columnSize--;
            }

            if (columnSize < gameManager.game.figures.length) {
              this.columns = 2;

              if (columnSize < minColumn) {
                columnSize = minColumn;
              } else if (columnSize > minColumn) {
                columnSize--;
              }

              height = 0;
              for (let i = 0; i < columnSize; i++) {
                height += figures[ i ].clientHeight;
              }

              let otherHeight = 0;
              for (let i = gameManager.game.figures.length - 1; i >= columnSize; i--) {
                if (otherHeight != 0 || !(gameManager.game.figures[ i ] instanceof Monster) || (gameManager.game.figures[ i ] as Monster).entities.some((entity) => !entity.dead && entity.health > 0)) {
                  otherHeight += figures[ i ].clientHeight;
                }
              }

              while (height < otherHeight) {
                otherHeight -= figures[ columnSize ].clientHeight;
                height += figures[ columnSize ].clientHeight;
                columnSize++;
              }

              while (height > container.clientHeight && otherHeight + figures[ columnSize - 1 ].clientHeight < container.clientHeight) {
                otherHeight += figures[ columnSize - 1 ].clientHeight;
                height -= figures[ columnSize - 1 ].clientHeight;
                columnSize--;
              }

              while (height > container.clientHeight && height > otherHeight && otherHeight + figures[ columnSize - 1 ].clientHeight < height) {
                otherHeight += figures[ columnSize - 1 ].clientHeight;
                height -= figures[ columnSize - 1 ].clientHeight;
                columnSize--;
              }

              this.columnSize = columnSize;
            } else {
              this.columns = 1;
              this.columnSize = 99;
            }
          } else {
            this.columns = 1;
            this.columnSize = 99;
          }

          this.translate(scrollTo);
        }
      }, 0);
    }
  }

  translate(scrollTo: HTMLElement | undefined = undefined) {
    setTimeout(() => {
      const container = this.element.nativeElement.getElementsByClassName('figures')[ 0 ];
      const figures = container.getElementsByClassName('figure');
      for (let index = 0; index < gameManager.game.figures.length; index++) {
        let start = 0;
        let left = "-50%";
        if (this.columns > 1) {
          const lastFigure = figures[ 0 ];
          const leftOffset = Math.floor(((container.clientWidth / 2) - lastFigure.clientWidth) / 4);
          if (index < this.columnSize) {
            left = "calc(-100% - " + leftOffset + "px)";
          } else {
            left = "calc(" + leftOffset + "px)";
            start = this.columnSize;
          }
        }

        let height = 0;
        for (let i = start; i < index; i++) {
          height += figures[ i ].clientHeight;
        }

        figures[ index ].style.transform = "scale(1) translate(" + left + "," + height + "px)";

        if (scrollTo) {
          setTimeout(() => {
            scrollTo.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'center'
            });
          }, 250);
        }
      }
    }, 1);
  }

  drop(event: CdkDragDrop<number>) {
    if (event.previousContainer != event.container && (event.currentIndex == 0 && event.container.data != event.previousContainer.data + 1 || event.currentIndex != 0 && event.container.data != event.previousContainer.data - event.currentIndex)) {
      let prev = event.previousContainer.data;
      let next = event.container.data;
      if (event.currentIndex > 0 && event.previousContainer.data > event.container.data) {
        next++;
      } else if (event.currentIndex == 0 && event.previousContainer.data < event.container.data) {
        next--;
      }
      gameManager.stateManager.before("reorder");
      moveItemInArray(gameManager.game.figures, prev, next);
      gameManager.stateManager.after();
      this.calcColumns(event.item.element.nativeElement);
    } else {
      this.translate();
    }
  }

  entered(event: CdkDragEnter<number>) {
    this.translate();
  }

  exited(event: CdkDragExit<number>) {
    this.translate();
  }

  handleClick(event: any) {
    let elements = document.elementsFromPoint(event.clientX, event.clientY);
    if (elements[ 0 ].classList.contains('cdk-drag-handle') && elements.length > 1) {
      (elements[ 1 ] as HTMLElement).click();
    }
  }
}
