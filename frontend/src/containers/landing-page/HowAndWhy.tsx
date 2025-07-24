interface HowAndWhyProps {
  techBgImage: string;
}

export default function HowAndWhy({ techBgImage }: HowAndWhyProps) {
  return (
    <section className="py-16 bg-gray-50" style={{ backgroundImage: `url(${techBgImage})` }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">How RepairCoin Works</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Earn tokens for repairs, redeem at participating shops, and be part of the repair revolution.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-lg shadow-lg text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔧</span>
            </div>
            <h3 className="text-xl font-semibold mb-4">Get Repairs</h3>
            <p className="text-gray-600">Visit participating repair shops and get your items fixed by certified professionals.</p>
          </div>
          
          <div className="bg-white p-8 rounded-lg shadow-lg text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🪙</span>
            </div>
            <h3 className="text-xl font-semibold mb-4">Earn Tokens</h3>
            <p className="text-gray-600">Receive RepairCoin tokens based on your repair spending and shop tier bonuses.</p>
          </div>
          
          <div className="bg-white p-8 rounded-lg shadow-lg text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🛍️</span>
            </div>
            <h3 className="text-xl font-semibold mb-4">Redeem Rewards</h3>
            <p className="text-gray-600">Use your tokens for discounts at any participating shop in the RepairCoin network.</p>
          </div>
        </div>
      </div>
    </section>
  );
}