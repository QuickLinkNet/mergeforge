import './Toast.css';

/** Short event message at the bottom of the map; the caller decides how long it stays. */
export function Toast({ message }: { readonly message: string }) {
  return <div className="event-toast" role="status">{message}</div>;
}
