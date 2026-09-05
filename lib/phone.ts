/** Builds a wa.me deep link from a phone number in any common format. */
export function toWhatsAppLink(phone: string) {
  const digits = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}`;
}
