import type { MemoData } from './types';
import { t } from './i18n';

const CELL_SIZE_PX = 11;

export class MemoHeatmap {
    private year = new Date().getFullYear();
    private selectedDate: string | null = null;

    constructor(
        private container: HTMLElement,
        private onDateChange: (date: string | null) => void,
    ) {}

    get dateFilter(): string | null {
        return this.selectedDate;
    }

    render(memos: MemoData[]): void {
        this.container.empty();
        const counts = this.countByDay(memos);
        const yearText = String(this.year);
        const yearTotal = [...counts.values()].reduce((sum, count) => sum + count, 0);

        const header = this.container.createDiv({ cls: 'hm-header' });
        const yearPill = header.createDiv({ cls: 'hm-year-pill' });
        const previousBtn = yearPill.createEl('button', {
            cls: 'hm-pill-btn',
            text: '‹',
            attr: {
                type: 'button',
                'data-action': 'previous-year',
                'aria-label': t('heatmapPreviousYear'),
                title: t('heatmapPreviousYear'),
            },
        });
        yearPill.createSpan({ cls: 'hm-pill-label', text: yearText });
        const nextBtn = yearPill.createEl('button', {
            cls: 'hm-pill-btn',
            text: '›',
            attr: {
                type: 'button',
                'data-action': 'next-year',
                'aria-label': t('heatmapNextYear'),
                title: t('heatmapNextYear'),
            },
        });
        header.createSpan({
            cls: 'hm-stat',
            text: t('heatmapSummary', { year: this.year, count: yearTotal }),
        });

        if (this.selectedDate) {
            const badge = header.createEl('button', {
                cls: 'hm-filter-badge',
                text: `${this.selectedDate} ×`,
                attr: {
                    type: 'button',
                    'aria-label': t('heatmapClearFilter', { date: this.selectedDate }),
                },
            });
            badge.onclick = () => {
                this.selectDate(null, memos);
                this.focusActiveDate();
            };
        }

        previousBtn.onclick = () => {
            this.year--;
            this.render(memos);
            this.container.querySelector<HTMLButtonElement>('[data-action="previous-year"]')?.focus();
        };
        nextBtn.onclick = () => {
            this.year++;
            this.render(memos);
            this.container.querySelector<HTMLButtonElement>('[data-action="next-year"]')?.focus();
        };

        const track = this.container.createDiv({ cls: 'hm-7row-track' });
        const scrollWrap = track.createDiv({ cls: 'hm-7row-scroll' });
        const jan1 = new Date(this.year, 0, 1);
        const jan1DayOfWeek = (jan1.getDay() + 6) % 7;
        const totalDays = this.isLeapYear(this.year) ? 366 : 365;
        const totalWeeks = Math.ceil((totalDays + jan1DayOfWeek) / 7);

        const monthHeader = scrollWrap.createDiv({ cls: 'hm-7row-month-header' });
        monthHeader.style.gridTemplateColumns = `repeat(${totalWeeks}, ${CELL_SIZE_PX}px)`;
        for (let month = 0; month < 12; month++) {
            const dayOffset = this.dayOfYear(this.year, month, 1) - 1;
            const weekIndex = Math.floor((dayOffset + jan1DayOfWeek) / 7);
            const label = monthHeader.createDiv({
                cls: 'hm-7row-month-label',
                text: String(month + 1),
            });
            label.style.gridColumnStart = String(weekIndex + 1);
        }

        const grid = scrollWrap.createDiv({ cls: 'hm-7row-grid' });
        grid.style.gridTemplateColumns = `repeat(${totalWeeks}, ${CELL_SIZE_PX}px)`;
        for (let pad = 0; pad < jan1DayOfWeek; pad++) {
            grid.createDiv({ cls: 'hm-cell empty-offset' });
        }

        const cells: HTMLButtonElement[] = [];
        const todayKey = this.formatDate(new Date());
        const initialFocusKey = this.selectedDate?.startsWith(yearText)
            ? this.selectedDate
            : todayKey.startsWith(yearText) ? todayKey : `${yearText}-01-01`;

        const focusCell = (index: number) => {
            const boundedIndex = Math.max(0, Math.min(index, cells.length - 1));
            for (const item of cells) item.tabIndex = -1;
            cells[boundedIndex].tabIndex = 0;
            cells[boundedIndex].focus();
        };

        for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
            const date = new Date(this.year, 0, dayOffset + 1);
            const dateKey = this.formatDate(date);
            const count = counts.get(dateKey) ?? 0;
            const summary = t('heatmapDaySummary', { date: dateKey, count });
            const cell = grid.createEl('button', {
                cls: 'hm-cell',
                attr: {
                    type: 'button',
                    title: summary,
                    'aria-label': summary,
                    'aria-pressed': String(this.selectedDate === dateKey),
                    tabindex: dateKey === initialFocusKey ? '0' : '-1',
                },
            });
            const cellIndex = cells.push(cell) - 1;
            if (count > 0) cell.addClass(`l-${Math.min(Math.ceil(count / 2), 4)}`);
            if (this.selectedDate === dateKey) cell.addClass('selected');
            cell.onclick = event => {
                event.stopPropagation();
                this.selectDate(this.selectedDate === dateKey ? null : dateKey, memos);
                this.focusActiveDate();
            };
            cell.onkeydown = event => {
                const offsets: Record<string, number> = {
                    ArrowUp: -1,
                    ArrowDown: 1,
                    ArrowLeft: -7,
                    ArrowRight: 7,
                };
                if (event.key === 'Home') {
                    event.preventDefault();
                    focusCell(0);
                } else if (event.key === 'End') {
                    event.preventDefault();
                    focusCell(cells.length - 1);
                } else if (offsets[event.key] !== undefined) {
                    event.preventDefault();
                    focusCell(cellIndex + offsets[event.key]);
                }
            };
        }
    }

    private selectDate(date: string | null, memos: MemoData[]): void {
        this.selectedDate = date;
        this.onDateChange(date);
        this.render(memos);
    }

    private focusActiveDate(): void {
        this.container.querySelector<HTMLButtonElement>('.hm-cell[tabindex="0"]')?.focus();
    }

    private countByDay(memos: MemoData[]): Map<string, number> {
        const counts = new Map<string, number>();
        const yearText = String(this.year);
        for (const memo of memos) {
            const date = memo.createdAt.substring(0, 10);
            if (!date.startsWith(yearText)) continue;
            counts.set(date, (counts.get(date) ?? 0) + 1);
        }
        return counts;
    }

    private formatDate(date: Date): string {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${date.getFullYear()}-${month}-${day}`;
    }

    private dayOfYear(year: number, month: number, day: number): number {
        const precedingMonthDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        const leapAdjustment = month > 1 && this.isLeapYear(year) ? 1 : 0;
        return precedingMonthDays[month] + day + leapAdjustment;
    }

    private isLeapYear(year: number): boolean {
        return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }
}
