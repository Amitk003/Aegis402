// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AegisSplitter
/// @notice Splits USDC payments between merchant and Aegis402 treasury
/// @dev Uses EIP-3009 TransferWithAuthorization for gasless payments
///      Merchant receives (amount - fee), treasury receives fee (0.5%)
contract AegisSplitter {
    error NotEnoughApproval();
    error TransferFailed();
    error ZeroAddress();

    event PaymentSplit(
        address indexed payer,
        address indexed merchant,
        uint256 merchantAmount,
        uint256 feeAmount,
        uint256 timestamp
    );

    IUSDC public immutable usdc;
    address public treasury;
    uint256 public constant FEE_BPS = 50; // 0.5% = 50 basis points
    uint256 public constant BPS_DENOMINATOR = 10000;

    constructor(address _usdc, address _treasury) {
        if (_usdc == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();
        usdc = IUSDC(_usdc);
        treasury = _treasury;
    }

    /// @notice Process a payment with automatic fee split
    /// @param from Payer's address
    /// @param to Merchant's address (payTo)
    /// @param amount Total amount in USDC (6 decimals)
    /// @param deadline Signature expiration timestamp
    /// @param v EIP-712 signature component
    /// @param r EIP-712 signature component
    /// @param s EIP-712 signature component
    function pay(
        address from,
        address to,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 merchantAmount, uint256 feeAmount) {
        if (to == address(0)) revert ZeroAddress();

        // Calculate split
        feeAmount = (amount * FEE_BPS) / BPS_DENOMINATOR;
        merchantAmount = amount - feeAmount;

        // Transfer full amount from payer to this contract
        usdc.transferFromWithAuthorization(
            from,
            address(this),
            amount,
            deadline,
            v,
            r,
            s
        );

        // Send merchant their share
        bool success = usdc.transfer(to, merchantAmount);
        if (!success) revert TransferFailed();

        // Send fee to treasury
        success = usdc.transfer(treasury, feeAmount);
        if (!success) revert TransferFailed();

        emit PaymentSplit(from, to, merchantAmount, feeAmount, block.timestamp);
    }

    /// @notice Process payment using EIP-3009 TransferWithAuthorization bytes
    /// @param to Merchant's address
    /// @param amount Total amount in USDC
    /// @param transferWithAuthorization Raw EIP-3009 authorization bytes
    function payWithAuthorization(
        address to,
        uint256 amount,
        bytes calldata transferWithAuthorization
    ) external returns (uint256 merchantAmount, uint256 feeAmount) {
        if (to == address(0)) revert ZeroAddress();

        feeAmount = (amount * FEE_BPS) / BPS_DENOMINATOR;
        merchantAmount = amount - feeAmount;

        usdc.transferWithAuthorization(transferWithAuthorization);

        bool success = usdc.transfer(to, merchantAmount);
        if (!success) revert TransferFailed();

        success = usdc.transfer(treasury, feeAmount);
        if (!success) revert TransferFailed();

        emit PaymentSplit(msg.sender, to, merchantAmount, feeAmount, block.timestamp);
    }

    /// @notice Update treasury address (owner-only in production)
    function setTreasury(address _treasury) external {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
    }
}

/// @notice Minimal USDC interface for EIP-3009
interface IUSDC {
    function transferFromWithAuthorization(
        address from,
        address to,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function transferWithAuthorization(bytes calldata authorization) external;

    function transfer(address to, uint256 amount) external returns (bool);

    function balanceOf(address account) external view returns (uint256);
}
