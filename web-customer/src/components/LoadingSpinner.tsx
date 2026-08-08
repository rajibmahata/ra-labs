export default function LoadingSpinner() {
  return (
    <div className="state-placeholder" role="status" aria-live="polite">
      <div className="spinner" aria-label="Loading" />
      <p>Loading...</p>
    </div>
  );
}
