import React, { use, useState, useEffect } from 'react';
import axios from 'axios';

const OpenRouterQA = () => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);


  const summaryData = {
    unique: 12,
    variants: 24,
    total: 100,
    value: 1245.67,
    currentCard: {
      title: "Pikachu V",
      price: 12.34,
      category: "Electric",
      description: "A popular electric-type Pokémon card.",
      rarity: "Rare Holo"
    }
  };

  const collectionData = [
    { title: "Charizard", count: 2, price_at_tcg: 45.00 },
    { title: "Bulbasaur", count: 5, price_at_tcg: 3.25 },
    { title: "Mewtwo", count: 1, price_at_tcg: 78.50 }
  ];

  const cardContext = {
    priceHistory: "Price started at $5.00 and is currently $12.34, with a 146.8% increase.",
    priceForecast: "Expected to increase over the next 3 months with 92% confidence. Estimated price: $15.00.",
    similarCards: ["Raichu V", "Zapdos"]
  };


  useEffect(() => {
    console.log("Collection Data:", collectionData);
    console.log("Summary Data:", summaryData);
    console.log("Card Context:", cardContext);
  },[]);




  // Prepare context from collection data and card context if available
  const prepareContext = () => {
    // Format collection summary data
    const summaryContext = `
    Collection Summary:
    - ${summaryData.unique} unique boosters
    - ${summaryData.variants} unique variants
    - ${summaryData.total} total boosters
    - Total market value: $${summaryData.value.toFixed(2)}

    `;

    // Format collection items data
    const collectionItemsContext = collectionData.map(item => {
      const price = item.price_at_tcg || 0;
      const value = price * item.count;
      return `- ${item.title}: ${item.count} cards, $${price.toFixed(2)} each, total value $${value.toFixed(2)}`;
    }).join('\n');

    // Add current card context if available
    let currentCardContext = '';
    if (cardContext && summaryData.currentCard) {
      currentCardContext = `
Currently Viewing Card:
- Name: ${summaryData.currentCard.title}
- Price: $${summaryData.currentCard.price.toFixed(2)}
- Category: ${summaryData.currentCard.category}
${summaryData.currentCard.description ? `- Description: ${summaryData.currentCard.description}` : ''}
${cardContext.priceHistory ? `- Price History: ${cardContext.priceHistory}` : ''}
${cardContext.priceForecast ? `- Price Forecast: ${cardContext.priceForecast}` : ''}
`;
    }

    return `${summaryContext}${currentCardContext ? '\n\nCurrent Card Details:' + currentCardContext : ''}\n\nCollection Details:\n${collectionItemsContext}`;
  };

  const askQuestion = async () => {
    if (!question.trim()) return;
    
    setLoading(true);
    setAnswer('');
    setQuestion('');
    
    try {
      const context = prepareContext();
      
      // Determine if the question is about the current card
      const isCardSpecificQuestion = cardContext && 
        (question.toLowerCase().includes('this card') || 
         question.toLowerCase().includes('current card') ||
         (summaryData.currentCard && question.toLowerCase().includes(summaryData.currentCard.title.toLowerCase())));
      
      // Create a system prompt that emphasizes the current card if relevant
      const systemPrompt = isCardSpecificQuestion
        ? `You are a helpful assistant analyzing a Pokémon card collection with focus on the currently viewed card. Use the following information to answer user questions, with particular attention to the "Current Card Details" section:
            
${context}

When answering questions about "this card" or "the current card", refer specifically to ${summaryData.currentCard?.title || 'the card being viewed'}. Respond concisely and accurately based only on the data provided. If you cannot answer based on the provided information, say so.`
        : `You are a helpful assistant analyzing a Pokémon card collection. Use only the following information to answer user questions:
            
${context}

Respond concisely and accurately based only on the data provided. If you cannot answer based on the provided information, say so.`;
      
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: "deepseek/deepseek-r1-distill-qwen-14b:free",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: question
          }
        ]
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer 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`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'PACKCast Pokémon Collection'
        }
      });
      
      setAnswer(response.data.choices[0].message.content);
    } catch (error) {
      console.error("Error querying OpenRouter API:", error);
      setAnswer("Sorry, I couldn't connect to the AI service. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Get a contextual placeholder based on whether we're viewing a card
  const getPlaceholder = () => {
    if (cardContext && summaryData.currentCard) {
      return `Ask about ${summaryData.currentCard.title} or your collection...`;
    }
    return "Ask a question about your collection...";
  };

  // Update chat title based on context
  const getChatTitle = () => {
    if (cardContext && summaryData.currentCard) {
      return "Ask about this card & collection";
    }
    return "Ask about your collection";
  };

  return (
    <div className="relative">
      {/* Chat button */}
      <button 
        onClick={() => setShowChat(!showChat)}
        className="fixed bottom-6 right-6 bg-orange-500 hover:bg-orange-600 text-white rounded-full p-4 shadow-lg z-10"
      >
        {showChat ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {showChat && (
        <div className="fixed bottom-20 right-6 w-80 md:w-96 bg-white rounded-lg shadow-xl z-10 overflow-hidden">
          <div className="bg-gray-800 text-white p-3 flex justify-between items-center">
            <h3 className="font-medium">{getChatTitle()}</h3>
            <div className="text-xs text-gray-300">Powered by DeepSeek</div>
          </div>
          
          <div className="p-4 h-64 overflow-y-auto">
            {cardContext && summaryData.currentCard && !answer && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
                <p>You can ask about {summaryData.currentCard.title}, price trends, or how it fits in your collection.</p>
              </div>
            )}
            {answer && (
              <div className="mb-4 p-3 bg-gray-100 rounded-lg">
                <p>{answer}</p>
              </div>
            )}
          </div>
          
          <div className="border-t p-3">
            <div className="flex items-center">
              <input 
                type="text" 
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={getPlaceholder()}
                className="flex-1 border rounded-l-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-500"
                onKeyDown={(e) => e.key === 'Enter' && askQuestion()}
              />
              <button 
                onClick={askQuestion}
                disabled={loading}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-r-md"
              >
                {loading ? (
                  <span className="block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpenRouterQA;