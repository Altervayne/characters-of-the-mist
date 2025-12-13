// -- Other Library Imports --
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"



export function cn(...inputs: ClassValue[]) {
   return twMerge(clsx(inputs))
}

export function getCardTypeClass(type: string) {
   return `card-type-${type.toLowerCase().replace(/\s+/g, '-')}`;
}
