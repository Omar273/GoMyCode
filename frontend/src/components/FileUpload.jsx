import { useRef, useState } from "react";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // mirror the backend limit

/**
 * Drag-and-drop / click-to-browse upload form.
 * Validates client-side BEFORE uploading so bad files fail fast,
 * and reports server errors (passed in via props) inline.
 */
export default function FileUpload({ onFileSelected, error }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [localError, setLocalError] = useState(null);
  const [numQuestions, setNumQuestions] = useState(10);

  function validate(selected) {
    if (!selected) return "Please choose a file first.";
    const isPdf =
      selected.type === "application/pdf" ||
      selected.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) return "Only PDF files are supported.";
    if (selected.size === 0) return "That file is empty.";
    if (selected.size > MAX_SIZE_BYTES) return "File must be 10 MB or smaller.";
    return null;
  }

  function accept(selected) {
    const problem = validate(selected);
    setLocalError(problem);
    setFile(problem ? null : selected); // keep the File object for submit
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    accept(event.dataTransfer.files?.[0]);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!file) {
      setLocalError("Please choose a file first.");
      return;
    }
    onFileSelected(file, numQuestions);
  }

  return (
    <form
      onSubmit={handleSubmit}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
        isDragging
          ? "border-indigo-500 bg-indigo-500/10"
          : "border-slate-700 bg-slate-900"
      }`}
    >
      {/* Hidden native input; the button below triggers it via ref */}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => accept(e.target.files?.[0])}
      />

      <p className="text-slate-300">
        {file ? file.name : "Drag & drop a PDF here, or"}
      </p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-3 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
      >
        Browse files
      </button>

      <div className="mt-6 flex items-center justify-center gap-3 text-sm text-slate-400">
        <label htmlFor="num-questions">Number of questions:</label>
        <input
          id="num-questions"
          type="number"
          min="1"
          max="30"
          value={numQuestions}
          onChange={(e) => setNumQuestions(Number(e.target.value))}
          className="w-20 rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-slate-100"
        />
      </div>

      {(localError || error) && (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {localError || error}
        </p>
      )}

      <button
        type="submit"
        disabled={!file}
        className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-700"
      >
        Generate Quiz
      </button>
    </form>
  );
}
