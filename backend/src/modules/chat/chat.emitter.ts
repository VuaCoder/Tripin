import type { Server } from 'socket.io';

export const userRoom = (userId: string) => `user:${userId}`;
export const adminRoom = () => 'role:admin';

let globalIo: Server | undefined;

export function setSocketIo(io: Server | undefined): void {
  globalIo = io;
}

export function getSocketIo(): Server | undefined {
  return globalIo;
}

export function emitToAdmin(event: string, payload: unknown): void {
  globalIo?.to('role:admin').emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  globalIo?.to(userRoom(userId)).emit(event, payload);
}
