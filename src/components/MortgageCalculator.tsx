import React, { useState, useMemo } from 'react';
import { DollarSign, Percent, Calendar, TrendingUp, PieChart as PieChartIcon, Info } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts';
import { cn } from '../lib/utils';
import { useAppContext } from '../contexts/AppContext';

interface MortgageCalculatorProps {
  price: number;
  growthPrediction?: string; // e.g., "15% over 5 years" or "5% annual"
}

export const MortgageCalculator: React.FC<MortgageCalculatorProps> = ({ price, growthPrediction }) => {
  const { theme } = useAppContext();
  const isDark = theme === 'dark';
  const [downPayment, setDownPayment] = useState(price * 0.2);
  const [interestRate, setInterestRate] = useState(6.5);
  const [loanTerm, setLoanTerm] = useState(30);
  const [propertyTaxRate, setPropertyTaxRate] = useState(1.2);
  const [insuranceRate, setInsuranceRate] = useState(0.5);

  const loanAmount = price - downPayment;
  
  const calculations = useMemo(() => {
    const monthlyRate = interestRate / 100 / 12;
    const numberOfPayments = loanTerm * 12;
    
    const monthlyPrincipalAndInterest = 
      (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
      (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
      
    const monthlyTax = (price * (propertyTaxRate / 100)) / 12;
    const monthlyInsurance = (price * (insuranceRate / 100)) / 12;
    
    const totalMonthly = monthlyPrincipalAndInterest + monthlyTax + monthlyInsurance;

    // ROI Projection
    // Extract numerical growth from string if possible, default to 5% annual
    let annualGrowth = 0.05;
    if (growthPrediction) {
      const match = growthPrediction.match(/(\d+)%/);
      if (match) {
        const totalGrowth = parseInt(match[1]) / 100;
        // If it says "over 5 years", calculate annual
        if (growthPrediction.toLowerCase().includes('5 years')) {
          annualGrowth = Math.pow(1 + totalGrowth, 1/5) - 1;
        } else {
          annualGrowth = totalGrowth;
        }
      }
    }

    const roiData = [];
    let currentVal = price;
    let totalPaid = downPayment;
    let currentEquity = downPayment;
    let remainingLoan = loanAmount;

    for (let year = 0; year <= 5; year++) {
      if (year > 0) {
        currentVal *= (1 + annualGrowth);
        const yearlyPAndI = monthlyPrincipalAndInterest * 12;
        const yearlyTaxAndIns = (monthlyTax + monthlyInsurance) * 12;
        totalPaid += yearlyPAndI + yearlyTaxAndIns;
        
        // Simplified amortization for equity calculation
        // In reality, more goes to interest early on
        const interestForYear = remainingLoan * (interestRate / 100);
        const principalForYear = yearlyPAndI - interestForYear;
        remainingLoan -= principalForYear;
        currentEquity = currentVal - remainingLoan;
      }

      roiData.push({
        year: `Year ${year}`,
        value: Math.round(currentVal),
        equity: Math.round(currentEquity),
        investment: Math.round(totalPaid),
        profit: Math.round(currentEquity - totalPaid)
      });
    }

    return {
      monthlyPrincipalAndInterest,
      monthlyTax,
      monthlyInsurance,
      totalMonthly,
      roiData
    };
  }, [price, downPayment, interestRate, loanTerm, propertyTaxRate, insuranceRate, growthPrediction, loanAmount]);

  return (
    <div className="space-y-4">
      {/* Mortgage Settings Card */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-xl">
        <div className="p-5 space-y-4">
          <h4 className="text-sm font-black text-neutral-900 dark:text-white flex items-center gap-2 uppercase tracking-widest">
            <DollarSign className="w-4 h-4 text-indigo-600" />
            Mortgage Settings
          </h4>
          
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.15em]">Down Payment</label>
              <div className="relative mt-1.5">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                <input
                  type="number"
                  value={downPayment}
                  onChange={(e) => setDownPayment(Number(e.target.value))}
                  className="w-full pl-9 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.15em]">Interest Rate (%)</label>
                <div className="relative mt-1.5">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                  <input
                    type="number"
                    step="0.1"
                    value={interestRate}
                    onChange={(e) => setInterestRate(Number(e.target.value))}
                    className="w-full pl-9 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.15em]">Loan Term (Yrs)</label>
                <div className="relative mt-1.5">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                  <select
                    value={loanTerm}
                    onChange={(e) => setLoanTerm(Number(e.target.value))}
                    className="w-full pl-9 pr-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none transition-all"
                  >
                    <option value={15}>15 Years</option>
                    <option value={30}>30 Years</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Summary - Full Width at bottom */}
        <div className="p-6 bg-indigo-600 text-white shadow-inner">
          <span className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em] mb-2 block text-center">Estimated Monthly Payment</span>
          <div className="text-4xl font-black mb-6 text-center">
            ${Math.round(calculations.totalMonthly).toLocaleString()}
          </div>
          <div className="grid grid-cols-3 gap-4 text-[10px] border-t border-indigo-500/50 pt-4">
            <div className="text-center">
              <div className="text-indigo-200 font-bold uppercase tracking-wider mb-1">P & I</div>
              <div className="font-black text-sm">${Math.round(calculations.monthlyPrincipalAndInterest).toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-indigo-200 font-bold uppercase tracking-wider mb-1">Taxes</div>
              <div className="font-black text-sm">${Math.round(calculations.monthlyTax).toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-indigo-200 font-bold uppercase tracking-wider mb-1">Insurance</div>
              <div className="font-black text-sm">${Math.round(calculations.monthlyInsurance).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ROI Chart Card */}
      <div className="p-5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <h4 className="font-black text-neutral-900 dark:text-white uppercase tracking-widest text-sm">5-Year ROI Projection</h4>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-neutral-400 italic">
            <Info className="w-3 h-3" />
            AI Growth Prediction
          </div>
        </div>

        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={calculations.roiData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#262626" : "#e5e5e5"} />
              <XAxis 
                dataKey="year" 
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 9, fill: isDark ? '#737373' : '#9ca3af', fontWeight: 700}}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 9, fill: isDark ? '#737373' : '#9ca3af', fontWeight: 700}}
                tickFormatter={(val) => `$${val/1000}k`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: isDark ? '#171717' : '#ffffff', 
                  border: isDark ? '1px solid #262626' : '1px solid #e5e5e5', 
                  borderRadius: '12px',
                  color: isDark ? '#fff' : '#000',
                  fontSize: '11px',
                  fontWeight: 700
                }}
                itemStyle={{ color: isDark ? '#fff' : '#000' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 700, paddingTop: '15px' }} />
              <Area 
                type="monotone" 
                dataKey="value" 
                name="Property Value" 
                stroke="#4f46e5" 
                fillOpacity={1} 
                fill="url(#colorValue)" 
                strokeWidth={2}
              />
              <Area 
                type="monotone" 
                dataKey="equity" 
                name="Your Equity" 
                stroke="#10b981" 
                fillOpacity={1} 
                fill="url(#colorProfit)" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-6 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl flex items-center justify-between border border-neutral-100 dark:border-neutral-700">
          <div>
            <span className="text-[9px] font-black text-neutral-400 uppercase tracking-[0.2em] block mb-1">Projected 5-Yr Profit</span>
            <span className={cn(
              "text-lg font-black",
              calculations.roiData[5].profit >= 0 ? "text-green-500" : "text-red-500"
            )}>
              ${calculations.roiData[5].profit.toLocaleString()}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[9px] font-black text-neutral-400 uppercase tracking-[0.2em] block mb-1">Est. Value Year 5</span>
            <span className="text-lg font-black text-neutral-900 dark:text-white">
              ${calculations.roiData[5].value.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
