// Thailand Banks Master Data

export const BankService = {
    getBanksData() {
        return [
            {
                id: 'BNK001',
                bankCode: 'BDO',
                bankName: 'BDO Unibank, Inc.',
                swiftCode: 'BNORPHMM',
                category: 'Universal Bank',
                mainBranch: 'BDO Corporate Center, Makati',
                contactNumber: '(+63 2) 8840-7000',
                email: 'customerservice@bdo.com.ph',
                status: 'Active',
                accounts: 5,
                totalBalance: '₱2,450,000'
            },
            {
                id: 'BNK002',
                bankCode: 'BPI',
                bankName: 'Bangkok Bank',
                swiftCode: 'BOPIPHMM',
                category: 'Universal Bank',
                mainBranch: 'BPI Main Building, Ayala Avenue, Makati',
                contactNumber: '(+63 2) 8889-1000',
                email: 'contactus@bpi.com.ph',
                status: 'Active',
                accounts: 3,
                totalBalance: '₱1,850,000'
            },
            {
                id: 'BNK003',
                bankCode: 'MBTC',
                bankName: 'Metropolitan Bank & Trust Company',
                swiftCode: 'MBTCPHMM',
                category: 'Universal Bank',
                mainBranch: 'Metrobank Plaza, Sen. Gil Puyat Ave., Makati',
                contactNumber: '(+63 2) 8898-8000',
                email: 'customercare@metrobank.com.ph',
                status: 'Active',
                accounts: 4,
                totalBalance: '₱3,200,000'
            },
            {
                id: 'BNK004',
                bankCode: 'LBP',
                bankName: 'Kasikorn Bank',
                swiftCode: 'TLBPPHMM',
                category: 'Government Bank',
                mainBranch: 'LANDBANK Plaza, 1598 M.H. del Pilar, Manila',
                contactNumber: '(+63 2) 8405-7000',
                email: 'customercare@mail.landbank.com',
                status: 'Active',
                accounts: 2,
                totalBalance: '₱980,000'
            },
            {
                id: 'BNK005',
                bankCode: 'PNB',
                bankName: 'Siam Commercial Bank',
                swiftCode: 'PNBMPHMM',
                category: 'Universal Bank',
                mainBranch: 'PNB Financial Center, Pasay City',
                contactNumber: '(+63 2) 8573-8888',
                email: 'customerservice@pnb.com.ph',
                status: 'Active',
                accounts: 2,
                totalBalance: '₱1,120,000'
            },
            {
                id: 'BNK006',
                bankCode: 'SBC',
                bankName: 'Security Bank Corporation',
                swiftCode: 'SETCPHMM',
                category: 'Universal Bank',
                mainBranch: 'Security Bank Centre, Ayala Avenue, Makati',
                contactNumber: '(+63 2) 8887-9188',
                email: 'customerservice@securitybank.com.ph',
                status: 'Active',
                accounts: 3,
                totalBalance: '₱1,650,000'
            },
            {
                id: 'BNK007',
                bankCode: 'UBP',
bankName: 'Krung Thai Bank',
      swiftCode: 'KRTHTHBK',
                category: 'Universal Bank',
                mainBranch: 'UnionBank Plaza, Meralco Avenue, Pasig',
                contactNumber: '(+63 2) 8841-8600',
                email: 'customerservice@unionbankph.com',
                status: 'Active',
                accounts: 2,
                totalBalance: '₱890,000'
            },
            {
                id: 'BNK008',
                bankCode: 'CBC',
                bankName: 'China Banking Corporation',
                swiftCode: 'CHBKPHMM',
                category: 'Universal Bank',
                mainBranch: 'China Bank Building, Paseo de Roxas, Makati',
                contactNumber: '(+63 2) 8888-5588',
                email: 'customerservice@chinabank.ph',
                status: 'Active',
                accounts: 1,
                totalBalance: '₱560,000'
            },
            {
                id: 'BNK009',
                bankCode: 'EWB',
                bankName: 'EastWest Banking Corporation',
                swiftCode: 'EWBCPHMM',
                category: 'Universal Bank',
                mainBranch: 'The Beaufort, BGC, Taguig',
                contactNumber: '(+63 2) 8888-1700',
                email: 'customerservice@eastwestbanker.com',
                status: 'Active',
                accounts: 2,
                totalBalance: '₱720,000'
            },
            {
                id: 'BNK010',
                bankCode: 'RCBC',
                bankName: 'Rizal Commercial Banking Corporation',
                swiftCode: 'RCBCPHMM',
                category: 'Universal Bank',
                mainBranch: 'RCBC Plaza, Ayala Avenue, Makati',
                contactNumber: '(+63 2) 8877-7222',
                email: 'customercare@rcbc.com',
                status: 'Active',
                accounts: 2,
                totalBalance: '₱1,340,000'
            },
            {
                id: 'BNK011',
                bankCode: 'PSB',
                bankName: 'TMBThanachart Bank',
                swiftCode: 'PHSBPHMM',
                category: 'Savings Bank',
                mainBranch: 'PSBank Center, Paseo de Roxas, Makati',
                contactNumber: '(+63 2) 8845-8888',
                email: 'customerservice@psbank.com.ph',
                status: 'Active',
                accounts: 1,
                totalBalance: '₱420,000'
            },
            {
                id: 'BNK012',
                bankCode: 'AUB',
                bankName: 'Asia United Bank Corporation',
                swiftCode: 'AUBKPHMM',
                category: 'Universal Bank',
                mainBranch: 'AUB Tower, Sen. Gil Puyat Ave., Makati',
                contactNumber: '(+63 2) 8841-2000',
                email: 'customercare@aub.com.ph',
                status: 'Active',
                accounts: 1,
                totalBalance: '₱380,000'
            }
        ];
    },

    getBankAccounts(bankCode) {
        const accounts = {
            'BDO': [
                {
                    accountNumber: '0012-3456-7890',
                    accountName: 'Premium Collection Account',
                    accountType: 'Current Account',
                    currency: 'PHP',
                    balance: '₱1,250,000',
                    status: 'Active'
                },
                {
                    accountNumber: '0012-3456-7891',
                    accountName: 'Claims Payment Account',
                    accountType: 'Current Account',
                    currency: 'PHP',
                    balance: '₱450,000',
                    status: 'Active'
                },
                {
                    accountNumber: '0012-3456-7892',
                    accountName: 'Commission Account',
                    accountType: 'Savings Account',
                    currency: 'PHP',
                    balance: '₱320,000',
                    status: 'Active'
                },
                {
                    accountNumber: '0012-3456-7893',
                    accountName: 'USD Account',
                    accountType: 'Foreign Currency Account',
                    currency: 'USD',
                    balance: '₱8,500',
                    status: 'Active'
                },
                {
                    accountNumber: '0012-3456-7894',
                    accountName: 'Payroll Account',
                    accountType: 'Payroll Account',
                    currency: 'PHP',
                    balance: '₱420,000',
                    status: 'Active'
                }
            ],
            'BPI': [
                {
                    accountNumber: '2234-5678-9012',
                    accountName: 'Operating Account',
                    accountType: 'Current Account',
                    currency: 'PHP',
                    balance: '₱950,000',
                    status: 'Active'
                },
                {
                    accountNumber: '2234-5678-9013',
                    accountName: 'Trust Account',
                    accountType: 'Trust Account',
                    currency: 'PHP',
                    balance: '₱680,000',
                    status: 'Active'
                },
                {
                    accountNumber: '2234-5678-9014',
                    accountName: 'Reserve Account',
                    accountType: 'Savings Account',
                    currency: 'PHP',
                    balance: '₱220,000',
                    status: 'Active'
                }
            ],
            'MBTC': [
                {
                    accountNumber: '3456-7890-1234',
                    accountName: 'Main Operating Account',
                    accountType: 'Current Account',
                    currency: 'PHP',
                    balance: '₱1,850,000',
                    status: 'Active'
                },
                {
                    accountNumber: '3456-7890-1235',
                    accountName: 'Premium Reserve Account',
                    accountType: 'Savings Account',
                    currency: 'PHP',
                    balance: '₱750,000',
                    status: 'Active'
                },
                {
                    accountNumber: '3456-7890-1236',
                    accountName: 'Claims Reserve Account',
                    accountType: 'Current Account',
                    currency: 'PHP',
                    balance: '₱420,000',
                    status: 'Active'
                },
                {
                    accountNumber: '3456-7890-1237',
                    accountName: 'Investment Account',
                    accountType: 'Time Deposit',
                    currency: 'PHP',
                    balance: '₱180,000',
                    status: 'Active'
                }
            ]
        };
        return accounts[bankCode] || [];
    },

    getTransactionHistory(accountNumber) {
        return [
            {
                date: '2025-03-28',
                reference: 'DEP-2025032801',
                description: 'Premium Collection - MIC-2025-MOT-00123',
                debit: '',
                credit: '₱22,500',
                balance: '₱1,272,500'
            },
            {
                date: '2025-03-27',
                reference: 'PMT-2025032701',
                description: 'Claims Payment - CLM-2025-00234',
                debit: '₱45,000',
                credit: '',
                balance: '₱1,250,000'
            },
            {
                date: '2025-03-26',
                reference: 'DEP-2025032602',
                description: 'Premium Collection - PGA-2025-MOT-00456',
                debit: '',
                credit: '₱18,500',
                balance: '₱1,295,000'
            },
            {
                date: '2025-03-25',
                reference: 'TRF-2025032501',
                description: 'Commission Transfer to Agent',
                debit: '₱15,750',
                credit: '',
                balance: '₱1,276,500'
            },
            {
                date: '2025-03-24',
                reference: 'DEP-2025032403',
                description: 'Group Health Premium - AXA-2025-HLT-00567',
                debit: '',
                credit: '₱625,000',
                balance: '₱1,292,250'
            }
        ];
    }
};

export default BankService;