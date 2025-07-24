interface FindARepairCoinProps {
  chainBgImage: string;
}

export default function FindARepairCoin({ chainBgImage }: FindARepairCoinProps) {
  return (
    <section className="py-16 bg-white" style={{ backgroundImage: `url(${chainBgImage})` }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Find RepairCoin Shops</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Discover certified repair shops in your area that accept RepairCoin tokens.
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-50 p-8 rounded-lg">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-2xl font-semibold mb-4">Shop Benefits</h3>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Earn tier bonuses on repairs</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Access to RepairCoin network</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Customer loyalty rewards</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Cross-shop redemption support</span>
                  </li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-2xl font-semibold mb-4">Customer Benefits</h3>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Earn tokens on every repair</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Redeem at any participating shop</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Build repair history</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    <span>Support sustainable repair culture</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}