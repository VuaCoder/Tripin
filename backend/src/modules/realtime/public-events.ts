export type PublicEventName = 'promotion:updated';

type PublicEventPublisher = (event: PublicEventName, payload: { id?: string }) => void;

let publisher: PublicEventPublisher | null = null;

export function setPublicEventPublisher(next: PublicEventPublisher): void {
  publisher = next;
}

export function publishPublicEvent(event: PublicEventName, payload: { id?: string } = {}): void {
  publisher?.(event, payload);
}
