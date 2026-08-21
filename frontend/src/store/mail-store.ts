import { atom } from 'jotai';
import type { EmailMessage, SendEmailPayload } from '../types/mail';

export const activeFolderAtom = atom<string>('INBOX');
export const selectedMessageIdAtom = atom<string | null>(null);
export const searchQueryAtom = atom<string>('');
export const isComposeOpenAtom = atom<boolean>(false);
export const composeInitialDataAtom = atom<Partial<SendEmailPayload> | null>(null);
export const selectedMessageIdsAtom = atom<string[]>([]);
