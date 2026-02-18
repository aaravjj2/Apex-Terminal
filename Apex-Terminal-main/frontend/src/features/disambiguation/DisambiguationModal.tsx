/**
 * Finance Lexicon Disambiguation Modal (Objective H, v1.12)
 * 
 * Shows when user enters an ambiguous token (e.g., A, I, ON, IT, ARE) that could be
 * either a ticker symbol or an English word.
 * 
 * Persists choice in session storage (not cross-run).
 */

interface DisambiguationModalProps {
  token: string;
  ticker: string;
  company?: string | null;
  onChooseTicker: () => void;
  onChooseWord: () => void;
  onCancel: () => void;
}

export function DisambiguationModal({
  token,
  ticker,
  company,
  onChooseTicker,
  onChooseWord,
  onCancel,
}: DisambiguationModalProps) {
  return (
    <div
      data-testid="disambiguation-modal"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        data-testid="disambiguation-dialog"
        className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2
            data-testid="disambiguation-title"
            className="text-lg font-semibold text-white"
          >
            Ambiguous Input: &quot;{token}&quot;
          </h2>
          <button
            data-testid="disambiguation-close"
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Explanation */}
        <p
          data-testid="disambiguation-explanation"
          className="text-sm text-gray-300 mb-6"
        >
          &quot;{token}&quot; can be interpreted as either a ticker symbol or an English word.
          Please choose how you want to proceed:
        </p>

        {/* Options */}
        <div className="space-y-3 mb-6">
          {/* Ticker Option */}
          <button
            data-testid="disambiguation-option-ticker"
            onClick={onChooseTicker}
            className="w-full p-4 border border-blue-600 bg-blue-600/10 hover:bg-blue-600/20 rounded-lg text-left transition-colors"
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center mr-3">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div>
                <div className="font-medium text-white mb-1">
                  Ticker Symbol: {ticker}
                </div>
                {company && (
                  <div
                    data-testid="disambiguation-ticker-company"
                    className="text-sm text-gray-400"
                  >
                    {company}
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  Load market data for this stock symbol
                </div>
              </div>
            </div>
          </button>

          {/* Word Option */}
          <button
            data-testid="disambiguation-option-word"
            onClick={onChooseWord}
            className="w-full p-4 border border-gray-600 bg-gray-800/50 hover:bg-gray-800 rounded-lg text-left transition-colors"
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center mr-3">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <div className="font-medium text-white mb-1">
                  English Word: &quot;{token}&quot;
                </div>
                <div className="text-xs text-gray-500">
                  Ignore as a ticker symbol
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Cancel */}
        <button
          data-testid="disambiguation-cancel"
          onClick={onCancel}
          className="w-full py-2 px-4 border border-gray-600 text-gray-300 hover:bg-gray-800 rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
