import React from 'react';

export const KELVS_PHONE_DISPLAY = '08054857982';
export const KELVS_PHONE_TEL = 'tel:+2348054857982';
export const KELVS_WHATSAPP_URL = 'https://wa.me/2348054857982';
export const KELVS_WHATSAPP_CHANNEL_URL =
  'https://chat.whatsapp.com/FZTOKOlYTSl5RLYnoYkQJG?s=cl&p=a&iam=2';

export function WhatsAppIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.969 0 1.766.469 3.484 1.344 5l-1.406 5.156 5.281-1.375c1.469.797 3.109 1.219 4.75 1.219 5.516 0 9.969-4.453 9.969-9.969S17.547 2 12.031 2zm5.813 14.125c-.25.703-1.438 1.344-1.984 1.422-.516.078-1.156.109-1.875-.125-.438-.141-1-.328-1.719-.641-3.016-1.297-4.984-4.328-5.141-4.531-.156-.203-1.234-1.641-1.234-3.125s.781-2.219 1.063-2.516c.281-.297.609-.375.813-.375.203 0 .406 0 .578.016.188.016.438-.078.688.516.25.609.859 2.094.938 2.25.078.156.125.344.031.547-.094.203-.141.328-.297.5-.156.172-.313.391-.453.516-.156.141-.313.297-.141.594.172.297.781 1.281 1.672 2.078 1.156 1.031 2.125 1.344 2.422 1.5.297.156.469.125.641-.078.172-.203.75-.875.953-1.172.203-.297.406-.25.672-.156.266.094 1.719.813 2.016.953.297.141.484.219.563.344.078.125.078.734-.172 1.438z" />
    </svg>
  );
}

export function FloatingWhatsAppButton() {
  return (
    <a
      href={KELVS_WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat directly on WhatsApp (08054857982)"
      title="Chat on WhatsApp (08054857982)"
      className="fixed bottom-5 right-5 z-40 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform duration-150 hover:scale-105 hover:bg-[#1ebe5d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1ebe5d]"
    >
      <WhatsAppIcon className="h-6 w-6 sm:h-7 sm:w-7" />
    </a>
  );
}
