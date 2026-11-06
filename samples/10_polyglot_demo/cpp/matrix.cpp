// Small dense matrix helper (sample code for CodeSentinel demos).
#include <stdexcept>
#include <vector>

class Matrix {
public:
    Matrix(int rows, int cols) : rows_(rows), cols_(cols), data_(rows * cols, 0.0) {}

    int rows() const { return rows_; }
    int cols() const { return cols_; }

    double &at(int r, int c) { return data_[r * cols_ + c]; }
    double at(int r, int c) const { return data_[r * cols_ + c]; }

    Matrix transpose() const {
        Matrix t(cols_, rows_);
        for (int r = 0; r < rows_; r++) {
            for (int c = 0; c < cols_; c++) {
                t.at(c, r) = at(r, c);
            }
        }
        return t;
    }

    Matrix multiply(const Matrix &other) const {
        if (cols_ != other.rows_) {
            throw std::invalid_argument("dimension mismatch");
        }
        Matrix out(rows_, other.cols_);
        for (int i = 0; i < rows_; i++) {
            for (int j = 0; j < other.cols_; j++) {
                double sum = 0.0;
                for (int k = 0; k < cols_; k++) {
                    sum += at(i, k) * other.at(k, j);
                }
                out.at(i, j) = sum;
            }
        }
        return out;
    }

private:
    int rows_;
    int cols_;
    std::vector<double> data_;
};
